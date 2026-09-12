import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  legacyTravelPlanToTravelBlock,
  normalizePlace,
} from "./travelUtils";
import { SCHEDULE_COLLECTION_NAMES } from "./scheduleCollections";
import {
  chunkFirestoreWrites,
  googleIntegrationPath,
  sanitizeGoogleIntegration,
  writableGoogleEventData,
} from "./googleCalendarPersistence";

export { legacyTravelPlanToTravelBlock } from "./travelUtils";

function userCollection(uid, collectionName) {
  return collection(db, "users", uid, collectionName);
}

function userDocument(uid, collectionName, documentId) {
  return doc(db, "users", uid, collectionName, String(documentId));
}

function dataWithId(documentSnapshot) {
  return { id: documentSnapshot.id, ...documentSnapshot.data() };
}

async function getCollectionData(uid, collectionName) {
  const snapshot = await getDocs(userCollection(uid, collectionName));
  return snapshot.docs.map(dataWithId);
}

export async function migrateLegacyTravelPlans(
  uid,
  legacyTravelPlans,
  existingTravelBlocks,
) {
  const existingIds = new Set(existingTravelBlocks.map((block) => block.id));
  const migratedBlocks = [];

  await Promise.all(
    legacyTravelPlans.map(async (travelPlan) => {
      if (travelPlan.migration_suppressed) return;
      const travelBlock = legacyTravelPlanToTravelBlock(travelPlan);
      if (existingIds.has(travelBlock.id)) return;
      await setDoc(
        userDocument(uid, "travelBlocks", travelBlock.id),
        Object.fromEntries(
          Object.entries(travelBlock).filter(([key]) => key !== "id"),
        ),
      );
      migratedBlocks.push(travelBlock);
    }),
  );
  return migratedBlocks;
}

export async function loadScheduleData(uid) {
  const [events, preparations, trips, travelBlocks, legacyTravelPlans] =
    await Promise.all(
      SCHEDULE_COLLECTION_NAMES.map((collectionName) =>
        getCollectionData(uid, collectionName),
      ),
    );
  const migratedTravelBlocks = await migrateLegacyTravelPlans(
    uid,
    legacyTravelPlans,
    travelBlocks,
  );
  return {
    events,
    preparations,
    trips,
    travelBlocks: [...travelBlocks, ...migratedTravelBlocks],
  };
}

export async function getGoogleCalendarIntegration(uid) {
  const snapshot = await getDoc(doc(db, ...googleIntegrationPath(uid)));
  return snapshot.exists()
    ? sanitizeGoogleIntegration(snapshot.data())
    : sanitizeGoogleIntegration();
}

export async function saveGoogleCalendarIntegration(uid, settings) {
  const sanitized = sanitizeGoogleIntegration(settings);
  await setDoc(doc(db, ...googleIntegrationPath(uid)), sanitized);
  return sanitized;
}

export async function saveGoogleCalendarSyncState(uid, calendarId, state) {
  const integrationDocument = doc(db, ...googleIntegrationPath(uid));
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(integrationDocument);
    const current = snapshot.exists()
      ? sanitizeGoogleIntegration(snapshot.data())
      : sanitizeGoogleIntegration();
    const next = sanitizeGoogleIntegration({
      ...current,
      sync_state: { ...current.sync_state, [calendarId]: state },
    });
    transaction.set(integrationDocument, next);
    return next;
  });
}

export async function listGoogleCalendarEventIds(uid, calendarId) {
  const snapshot = await getDocs(
    query(
      userCollection(uid, "events"),
      where("source", "==", "google_calendar"),
      where("external.calendar_id", "==", calendarId),
    ),
  );
  return snapshot.docs.map((item) => item.id);
}

export async function writeGoogleCalendarEvents(uid, events) {
  for (const eventChunk of chunkFirestoreWrites(events)) {
    const batch = writeBatch(db);
    eventChunk.forEach((event) => {
      const { id, ...documentData } = event;
      batch.set(userDocument(uid, "events", id), documentData, { merge: true });
    });
    await batch.commit();
  }
}

export async function createEvent(uid, eventData) {
  const documentData = {
    trip_id: null,
    calendar_visibility: "normal",
    ...eventData,
  };
  const documentReference = await addDoc(
    userCollection(uid, "events"),
    documentData,
  );
  return { id: documentReference.id, ...documentData };
}

const EVENT_ROUTE_FIELDS = [
  "start_at",
  "end_at",
  "location_name",
  "destination",
  "destination_place_id",
  "destination_lat",
  "destination_lng",
  "arrival_buffer_minutes",
];

async function getEventTravelBlockDocuments(uid, eventId) {
  const collectionReference = userCollection(uid, "travelBlocks");
  const [originSnapshot, destinationSnapshot] = await Promise.all([
    getDocs(
      query(
        collectionReference,
        where("origin_event_id", "==", String(eventId)),
      ),
    ),
    getDocs(
      query(
        collectionReference,
        where("destination_event_id", "==", String(eventId)),
      ),
    ),
  ]);
  return new Map(
    [...originSnapshot.docs, ...destinationSnapshot.docs].map((snapshot) => [
      snapshot.id,
      snapshot,
    ]),
  );
}

export async function updateEvent(uid, eventId, eventData) {
  const eventDocument = userDocument(uid, "events", eventId);
  const previousSnapshot = await getDoc(eventDocument);
  const previousEvent = previousSnapshot.exists() ? previousSnapshot.data() : {};
  const writableEventData = previousEvent.source === "google_calendar"
    ? writableGoogleEventData(eventData)
    : eventData;
  const routeFieldsChanged = EVENT_ROUTE_FIELDS.some(
    (field) => previousEvent[field] !== writableEventData[field],
  );

  if (!routeFieldsChanged) {
    await updateDoc(eventDocument, writableEventData);
    return { id: String(eventId), ...previousEvent, ...writableEventData };
  }

  const linkedDocuments = await getEventTravelBlockDocuments(uid, eventId);
  const batch = writeBatch(db);
  batch.update(eventDocument, writableEventData);
  linkedDocuments.forEach((snapshot) => {
    const reasons = new Set(snapshot.data().review_reasons ?? []);
    reasons.add("linked_event_changed");
    batch.update(snapshot.ref, {
      needs_review: true,
      review_reasons: [...reasons],
    });
  });
  await batch.commit();
  return { id: String(eventId), ...previousEvent, ...writableEventData };
}

export async function deleteEvent(uid, eventId, travelBlockAction = "keep") {
  const [preparationsSnapshot, linkedDocuments, legacyTravelPlanSnapshot] = await Promise.all([
    getDocs(
      query(
        userCollection(uid, "preparations"),
        where("event_id", "==", String(eventId)),
      ),
    ),
    getEventTravelBlockDocuments(uid, eventId),
    getDoc(userDocument(uid, "travelPlans", eventId)),
  ]);
  const batch = writeBatch(db);
  preparationsSnapshot.docs.forEach((snapshot) => batch.delete(snapshot.ref));
  linkedDocuments.forEach((snapshot) => {
    if (travelBlockAction === "delete") {
      batch.delete(snapshot.ref);
      return;
    }
    const data = snapshot.data();
    const reasons = new Set(data.review_reasons ?? []);
    reasons.add("linked_event_deleted");
    batch.update(snapshot.ref, {
      origin_event_id:
        data.origin_event_id === String(eventId)
          ? null
          : data.origin_event_id ?? null,
      destination_event_id:
        data.destination_event_id === String(eventId)
          ? null
          : data.destination_event_id ?? null,
      needs_review: true,
      review_reasons: [...reasons],
    });
  });
  if (travelBlockAction === "delete" && legacyTravelPlanSnapshot.exists()) {
    batch.update(legacyTravelPlanSnapshot.ref, {
      migration_suppressed: true,
    });
  }
  batch.delete(userDocument(uid, "events", eventId));
  await batch.commit();
}

export async function createPreparation(uid, ownerType, ownerId, title) {
  const documentData = {
    owner_type: ownerType,
    event_id: ownerType === "event" ? String(ownerId) : null,
    trip_id: ownerType === "trip" ? String(ownerId) : null,
    title,
    completed: false,
  };
  const documentReference = await addDoc(
    userCollection(uid, "preparations"),
    documentData,
  );
  return { id: documentReference.id, ...documentData };
}

export async function updatePreparation(uid, preparationId, preparationData) {
  await updateDoc(
    userDocument(uid, "preparations", preparationId),
    preparationData,
  );
  return { id: String(preparationId), ...preparationData };
}

export async function deletePreparation(
  uid,
  ownerType,
  ownerId,
  preparationId,
) {
  const preparationDocument = userDocument(
    uid,
    "preparations",
    preparationId,
  );
  const snapshot = await getDoc(preparationDocument);
  const data = snapshot.exists() ? snapshot.data() : null;
  const ownerMatches =
    ownerType === "trip"
      ? data?.trip_id === String(ownerId)
      : data?.event_id === String(ownerId);
  if (!data || !ownerMatches) {
    throw new Error("準備項目が見つかりません");
  }
  await deleteDoc(preparationDocument);
}

export async function createTrip(uid, tripData) {
  const documentReference = await addDoc(
    userCollection(uid, "trips"),
    tripData,
  );
  return { id: documentReference.id, ...tripData };
}

export async function updateTrip(uid, tripId, tripData) {
  await updateDoc(userDocument(uid, "trips", tripId), tripData);
  return { id: String(tripId), ...tripData };
}

export async function createTripFromEvent(uid, event) {
  const tripReference = doc(userCollection(uid, "trips"));
  const tripData = {
    title: event.title,
    notes: event.description ?? "",
    start_at: event.start_at ?? null,
    end_at: event.end_at ?? null,
    source_event_id: String(event.id),
  };
  const eventId = event.id;
  const transientKeys = new Set([
    "id",
    "calendar_kind",
    "position",
    "column",
    "columnCount",
    "hasOverlap",
    "leftPercent",
    "widthPercent",
  ]);
  const eventData = Object.fromEntries(
    Object.entries(event).filter(([key]) => !transientKeys.has(key)),
  );
  const updatedEvent = {
    id: eventId,
    ...eventData,
    trip_id: tripReference.id,
    calendar_visibility: "trip_overview_hidden",
  };
  const batch = writeBatch(db);
  batch.set(tripReference, tripData);
  batch.update(
    userDocument(uid, "events", eventId),
    Object.fromEntries(
      Object.entries(updatedEvent).filter(([key]) => key !== "id"),
    ),
  );
  await batch.commit();
  return {
    trip: { id: tripReference.id, ...tripData },
    event: updatedEvent,
  };
}

export async function deleteTrip(uid, tripId, childAction = "keep") {
  const [eventsSnapshot, blocksSnapshot, preparationsSnapshot] =
    await Promise.all([
      getDocs(
        query(
          userCollection(uid, "events"),
          where("trip_id", "==", String(tripId)),
        ),
      ),
      getDocs(userCollection(uid, "travelBlocks")),
      getDocs(userCollection(uid, "preparations")),
    ]);
  const batch = writeBatch(db);
  const childEventIds = new Set(eventsSnapshot.docs.map((snapshot) => snapshot.id));
  eventsSnapshot.docs.forEach((snapshot) => {
    if (childAction === "delete") batch.delete(snapshot.ref);
    else batch.update(snapshot.ref, { trip_id: null, calendar_visibility: "normal" });
  });
  blocksSnapshot.docs.forEach((snapshot) => {
    const data = snapshot.data();
    const belongsToTrip = data.trip_id === String(tripId);
    const linksChildEvent =
      childEventIds.has(data.origin_event_id) ||
      childEventIds.has(data.destination_event_id);
    if (childAction === "delete" && (belongsToTrip || linksChildEvent)) {
      batch.delete(snapshot.ref);
    } else if (belongsToTrip) {
      batch.update(snapshot.ref, { trip_id: null });
    }
  });
  preparationsSnapshot.docs.forEach((snapshot) => {
    const data = snapshot.data();
    if (
      data.trip_id === String(tripId) ||
      (childAction === "delete" && childEventIds.has(data.event_id))
    ) {
      batch.delete(snapshot.ref);
    }
  });
  batch.delete(userDocument(uid, "trips", tripId));
  await batch.commit();
}

export async function createTravelBlock(uid, travelBlockData) {
  const documentData = {
    trip_id: null,
    origin_event_id: null,
    destination_event_id: null,
    booking_status: "planned",
    needs_review: false,
    review_reasons: [],
    notices: [],
    segments: [],
    ...travelBlockData,
  };
  const documentReference = await addDoc(
    userCollection(uid, "travelBlocks"),
    documentData,
  );
  return { id: documentReference.id, ...documentData };
}

export async function updateTravelBlock(uid, travelBlockId, travelBlockData) {
  await updateDoc(
    userDocument(uid, "travelBlocks", travelBlockId),
    travelBlockData,
  );
  return { id: String(travelBlockId), ...travelBlockData };
}

export async function deleteTravelBlock(uid, travelBlockId) {
  const travelBlockDocument = userDocument(
    uid,
    "travelBlocks",
    travelBlockId,
  );
  const travelBlockSnapshot = await getDoc(travelBlockDocument);
  const legacyTravelPlanId = travelBlockSnapshot.exists()
    ? travelBlockSnapshot.data().legacy_travel_plan_id
    : null;
  if (!legacyTravelPlanId) {
    await deleteDoc(travelBlockDocument);
    return;
  }
  const legacyDocument = userDocument(
    uid,
    "travelPlans",
    legacyTravelPlanId,
  );
  const legacySnapshot = await getDoc(legacyDocument);
  const batch = writeBatch(db);
  batch.delete(travelBlockDocument);
  if (legacySnapshot.exists()) {
    batch.update(legacyDocument, { migration_suppressed: true });
  }
  await batch.commit();
}

// Temporary compatibility exports for callers that have not moved to travelBlocks.
export async function getTravelPlan(uid, eventId) {
  const snapshot = await getDoc(userDocument(uid, "travelPlans", eventId));
  return snapshot.exists() ? dataWithId(snapshot) : null;
}

export async function saveTravelPlan(uid, eventId, route) {
  return createTravelBlock(uid, {
    title: `${route.origin} → ${route.destination}`,
    start_at: route.departure_at,
    end_at: route.arrival_at,
    origin: normalizePlace(route.origin),
    destination: normalizePlace(route.destination),
    source_type: "route_search",
    transport_mode: route.transport_mode,
    destination_event_id: String(eventId),
    provider: route.provider ?? "legacy",
    route_kind:
      route.route_kind ??
      (route.transport_mode === "WALK" ? "walk" : "transit"),
    is_fallback: route.is_fallback ?? false,
    notices: route.notices ?? [],
    segments: route.segments ?? [],
    duration_minutes: route.duration_minutes,
  });
}
