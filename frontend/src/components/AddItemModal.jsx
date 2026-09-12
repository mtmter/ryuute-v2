import { useEffect, useState } from "react";
import { parseDateTime, toDateTimeInputValue } from "../dateUtils";
import DateTimePicker from "./DateTimePicker";
import PlaceAutocompleteInput from "./PlaceAutocompleteInput";

function AddItemModal({ initialValues, onClose, onSubmit, trips = [] }) {
  const [itemType, setItemType] = useState(initialValues.itemType);
  const [title, setTitle] = useState("");
  const [eventStartAt, setEventStartAt] = useState(
    initialValues.eventStartAt,
  );
  const [eventEndAt, setEventEndAt] = useState(initialValues.eventEndAt);
  const [taskDueAt, setTaskDueAt] = useState(initialValues.taskDueAt);
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState("");
  const [destination, setDestination] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [arrivalBufferMinutes, setArrivalBufferMinutes] = useState("");
  const [tripId, setTripId] = useState(initialValues.tripId ?? "");
  const [originName, setOriginName] = useState("");
  const [travelMode, setTravelMode] = useState("train");
  const [bookingStatus, setBookingStatus] = useState("planned");
  const [linkUrl, setLinkUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSubmitting, onClose]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim()) {
      setErrorMessage("タイトルを入力してください");
      return;
    }

    if (itemType === "event" || itemType === "travel") {
      if (!eventStartAt || !eventEndAt) {
        setErrorMessage("開始日時と終了日時を入力してください");
        return;
      }

      if (eventEndAt < eventStartAt) {
        setErrorMessage("終了日時は開始日時以降にしてください");
        return;
      }

      if (
        arrivalBufferMinutes !== "" &&
        (!Number.isInteger(Number(arrivalBufferMinutes)) ||
          Number(arrivalBufferMinutes) < 0)
      ) {
        setErrorMessage("到着余裕時間は0以上の整数で入力してください");
        return;
      }
    }

    if (itemType === "travel" && (!originName.trim() || !destination.trim())) {
      setErrorMessage("出発地と目的地を入力してください");
      return;
    }

    if (itemType === "trip" && eventStartAt && eventEndAt && eventEndAt < eventStartAt) {
      setErrorMessage("終了日時は開始日時以降にしてください");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      if (itemType === "event") {
        await onSubmit("event", {
          title: title.trim(),
          start_at: eventStartAt,
          end_at: eventEndAt,
          description,
          location_name: locationName.trim() || null,
          destination: destination.trim() || null,
          destination_place_id: selectedPlace?.place_id || null,
          destination_lat: selectedPlace?.lat ?? null,
          destination_lng: selectedPlace?.lng ?? null,
          arrival_buffer_minutes:
            arrivalBufferMinutes === "" ? null : Number(arrivalBufferMinutes),
          trip_id: tripId || null,
        });
      } else if (itemType === "travel") {
        await onSubmit("travel", {
          title: title.trim(),
          start_at: eventStartAt,
          end_at: eventEndAt,
          origin: { name: originName.trim(), address: null, place_id: null, lat: null, lng: null },
          destination: { name: destination.trim(), address: null, place_id: null, lat: null, lng: null },
          source_type: "manual",
          transport_mode: travelMode,
          booking_status: bookingStatus,
          memo: description,
          link_url: linkUrl.trim() || null,
          trip_id: tripId || null,
        });
      } else if (itemType === "trip") {
        await onSubmit("trip", {
          title: title.trim(),
          notes: description,
          start_at: eventStartAt || null,
          end_at: eventEndAt || null,
        });
      } else {
        await onSubmit("task", {
          title: title.trim(),
          due_at: taskDueAt || null,
          description,
        });
      }
    } catch (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
    }
  }

  function handleEventStartChange(nextStartAt) {
    const currentStart = parseDateTime(eventStartAt);
    const currentEnd = parseDateTime(eventEndAt);
    const nextStart = parseDateTime(nextStartAt);
    const duration =
      currentStart && currentEnd && currentEnd >= currentStart
        ? currentEnd.getTime() - currentStart.getTime()
        : 60 * 60 * 1000;

    setEventStartAt(nextStartAt);
    if (nextStart) {
      setEventEndAt(
        toDateTimeInputValue(new Date(nextStart.getTime() + duration)),
      );
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <section
        className="add-item-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-item-heading"
      >
        <div className="modal-header">
          <div>
            <p>新しく追加</p>
            <h2 id="add-item-heading">
              {itemType === "event"
                ? "予定を追加"
                : itemType === "travel"
                  ? "移動を追加"
                  : itemType === "trip"
                    ? "Tripを追加"
                    : "タスクを追加"}
            </h2>
          </div>
          <button
            className="modal-close-button"
            type="button"
            aria-label="閉じる"
            disabled={isSubmitting}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="item-type-tabs" aria-label="追加する種類">
          <button
            className={itemType === "event" ? "is-active" : ""}
            type="button"
            onClick={() => {
              setItemType("event");
              setErrorMessage("");
            }}
          >
            予定
          </button>
          <button
            className={itemType === "travel" ? "is-active" : ""}
            type="button"
            onClick={() => {
              setItemType("travel");
              setErrorMessage("");
            }}
          >
            移動
          </button>
          <button
            className={itemType === "trip" ? "is-active" : ""}
            type="button"
            onClick={() => {
              setItemType("trip");
              setErrorMessage("");
            }}
          >
            Trip
          </button>
          <button
            className={itemType === "task" ? "is-active" : ""}
            type="button"
            onClick={() => {
              setItemType("task");
              setErrorMessage("");
            }}
          >
            タスク
          </button>
        </div>

        <form className="add-item-form" onSubmit={handleSubmit}>
          <div className="modal-form-field">
            <label htmlFor="item-title">
              {itemType === "event"
                ? "予定タイトル"
                : itemType === "travel"
                  ? "便名・移動タイトル"
                  : itemType === "trip"
                    ? "Tripタイトル"
                    : "タスクタイトル"}
            </label>
            <input
              id="item-title"
              type="text"
              value={title}
              placeholder={
                itemType === "event"
                  ? "例：ミーティング"
                  : itemType === "travel"
                    ? "例：東京行き夜行バス"
                    : itemType === "trip"
                      ? "例：京都旅行"
                      : "例：資料を作る"
              }
              autoFocus
              required
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          {itemType === "event" ? (
            <>
              <div className="modal-date-fields">
                <DateTimePicker
                  id="event-start-at"
                  label="開始日時"
                  value={eventStartAt}
                  onChange={handleEventStartChange}
                />
                <DateTimePicker
                  id="event-end-at"
                  label="終了日時"
                  value={eventEndAt}
                  min={eventStartAt}
                  onChange={setEventEndAt}
                />
              </div>

              <div className="modal-form-field">
                <label htmlFor="event-location-name">
                  場所名 <span>任意</span>
                </label>
                <PlaceAutocompleteInput
                  id="event-location-name"
                  value={locationName}
                  placeholder="例：Garraway F"
                  disabled={isSubmitting}
                  onChange={(nextLocationName) => {
                    setLocationName(nextLocationName);
                    setSelectedPlace(null);
                  }}
                  onPlaceSelect={(place) => {
                    setSelectedPlace(place);
                    if (place) {
                      setLocationName(place.name);
                      setDestination(place.address);
                    }
                  }}
                />
              </div>

              <div className="modal-form-field">
                <label htmlFor="event-destination">
                  目的地 <span>任意</span>
                </label>
                <input
                  id="event-destination"
                  type="text"
                  value={destination}
                  placeholder="住所・駅名・施設名"
                  onChange={(event) => {
                    setDestination(event.target.value);
                    setSelectedPlace(null);
                  }}
                />
              </div>

              <div className="modal-form-field">
                <label htmlFor="event-arrival-buffer-minutes">
                  到着余裕時間（分） <span>任意</span>
                </label>
                <input
                  id="event-arrival-buffer-minutes"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={arrivalBufferMinutes}
                  placeholder="例：10"
                  onChange={(event) =>
                    setArrivalBufferMinutes(event.target.value)
                  }
                />
              </div>

              <div className="modal-form-field">
                <label htmlFor="event-trip">Trip <span>任意</span></label>
                <select id="event-trip" value={tripId} onChange={(event) => setTripId(event.target.value)}>
                  <option value="">関連付けない</option>
                  {trips.map((trip) => <option value={trip.id} key={trip.id}>{trip.title}</option>)}
                </select>
              </div>
            </>
          ) : itemType === "travel" ? (
            <>
              <div className="modal-date-fields">
                <DateTimePicker id="travel-start-at" label="出発日時" value={eventStartAt} onChange={handleEventStartChange} />
                <DateTimePicker id="travel-end-at" label="到着日時" value={eventEndAt} min={eventStartAt} onChange={setEventEndAt} />
              </div>
              <div className="modal-form-field">
                <label htmlFor="travel-origin">出発地</label>
                <input id="travel-origin" value={originName} onChange={(event) => setOriginName(event.target.value)} placeholder="例：京都駅" />
              </div>
              <div className="modal-form-field">
                <label htmlFor="travel-destination">目的地</label>
                <input id="travel-destination" value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="例：嵐山" />
              </div>
              <div className="modal-date-fields">
                <div className="modal-form-field">
                  <label htmlFor="travel-mode">交通手段</label>
                  <select id="travel-mode" value={travelMode} onChange={(event) => setTravelMode(event.target.value)}>
                    <option value="train">鉄道</option><option value="bus">バス</option><option value="flight">飛行機</option><option value="ferry">船</option><option value="walk">徒歩</option><option value="car">車</option><option value="bike">自転車</option><option value="other">その他</option>
                  </select>
                </div>
                <div className="modal-form-field">
                  <label htmlFor="travel-booking">予約状態</label>
                  <select id="travel-booking" value={bookingStatus} onChange={(event) => setBookingStatus(event.target.value)}>
                    <option value="planned">未予約・予定</option><option value="booked">予約済み</option>
                  </select>
                </div>
              </div>
              <div className="modal-form-field">
                <label htmlFor="travel-trip">Trip <span>任意</span></label>
                <select id="travel-trip" value={tripId} onChange={(event) => setTripId(event.target.value)}>
                  <option value="">関連付けない</option>
                  {trips.map((trip) => <option value={trip.id} key={trip.id}>{trip.title}</option>)}
                </select>
              </div>
              <div className="modal-form-field">
                <label htmlFor="travel-link">予約・案内URL <span>任意</span></label>
                <input id="travel-link" type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} />
              </div>
            </>
          ) : itemType === "trip" ? (
            <div className="modal-date-fields">
              <DateTimePicker id="trip-start-at" label="開始日時" optional value={eventStartAt} onChange={handleEventStartChange} />
              <DateTimePicker id="trip-end-at" label="終了日時" optional value={eventEndAt} min={eventStartAt} onChange={setEventEndAt} />
            </div>
          ) : (
            <DateTimePicker
              defaultTime="23:45"
              id="task-due-at"
              label="期限"
              optional
              value={taskDueAt}
              onChange={setTaskDueAt}
            />
          )}

          <div className="modal-form-field">
            <label htmlFor="item-description">
              説明 <span>任意</span>
            </label>
            <textarea
              id="item-description"
              value={description}
              placeholder="補足があれば入力してください"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {errorMessage && (
            <p className="modal-error-message" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="modal-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
            >
              キャンセル
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "追加中..." : "追加"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default AddItemModal;
