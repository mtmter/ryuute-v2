function TripList({ trips, onSelect }) {
  const sortedTrips = [...trips].sort((first, second) =>
    (first.start_at ?? "9999").localeCompare(second.start_at ?? "9999"),
  );
  return (
    <section className="trip-list" aria-labelledby="trip-list-heading">
      <div><p>旅程をまとめる</p><h2 id="trip-list-heading">Trip</h2></div>
      {sortedTrips.length === 0 ? <p className="status-message">Tripはまだありません。「追加」から作成できます。</p> : (
        <div className="trip-card-grid">{sortedTrips.map((trip) => <button className="trip-card" type="button" key={trip.id} onClick={() => onSelect(trip)}><strong>{trip.title}</strong><span>{trip.start_at?.slice(0, 10) || "期間未設定"}{trip.end_at ? ` – ${trip.end_at.slice(0, 10)}` : ""}</span><p>{trip.notes || "メモなし"}</p></button>)}</div>
      )}
    </section>
  );
}

export default TripList;
