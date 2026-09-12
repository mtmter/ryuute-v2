import { useEffect, useState } from "react";
import { formatTime } from "../dateUtils";
import { getPlaceLabel } from "../travelUtils";
import DateTimePicker from "./DateTimePicker";
import AdjacentRouteSearch from "./AdjacentRouteSearch";

const REVIEW_LABELS = {
  linked_event_changed: "関連予定の日時または場所が変更されました",
  linked_event_deleted: "関連予定が削除されました",
};

function TravelBlockDetailsModal({ travelBlock, trips, onClose, onDelete, onDirectRouteRegister, onDirectRouteSearch, onUpdate }) {
  const [mode, setMode] = useState("details");
  const [title, setTitle] = useState(travelBlock.title);
  const [startAt, setStartAt] = useState(travelBlock.start_at);
  const [endAt, setEndAt] = useState(travelBlock.end_at);
  const [origin, setOrigin] = useState(getPlaceLabel(travelBlock.origin));
  const [destination, setDestination] = useState(getPlaceLabel(travelBlock.destination));
  const [transportMode, setTransportMode] = useState(travelBlock.transport_mode ?? "other");
  const [bookingStatus, setBookingStatus] = useState(travelBlock.booking_status ?? "planned");
  const [tripId, setTripId] = useState(travelBlock.trip_id ?? "");
  const [memo, setMemo] = useState(travelBlock.memo ?? "");
  const [linkUrl, setLinkUrl] = useState(travelBlock.link_url ?? "");
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !isBusy) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, onClose]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!title.trim() || !origin.trim() || !destination.trim()) {
      setErrorMessage("タイトル、出発地、目的地を入力してください");
      return;
    }
    if (!startAt || !endAt || endAt < startAt) {
      setErrorMessage("出発・到着日時を確認してください");
      return;
    }
    setIsBusy(true);
    try {
      await onUpdate(travelBlock.id, {
        ...travelBlock,
        title: title.trim(),
        start_at: startAt,
        end_at: endAt,
        origin: { ...travelBlock.origin, name: origin.trim() },
        destination: { ...travelBlock.destination, name: destination.trim() },
        transport_mode: transportMode,
        booking_status: bookingStatus,
        trip_id: tripId || null,
        memo,
        link_url: linkUrl.trim() || null,
      });
      setMode("details");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete() {
    setIsBusy(true);
    try {
      await onDelete(travelBlock.id);
    } catch (error) {
      setErrorMessage(error.message);
      setIsBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !isBusy && onClose()}>
      <section className="event-details-modal" role="dialog" aria-modal="true" aria-labelledby="travel-block-heading">
        <div className="modal-header">
          <div><p>移動ブロック</p><h2 id="travel-block-heading">{mode === "edit" ? "移動を編集" : travelBlock.title}</h2></div>
          <button className="modal-close-button" type="button" onClick={onClose} disabled={isBusy}>×</button>
        </div>
        {mode === "route-before" || mode === "route-after" ? (
          <AdjacentRouteSearch
            anchor={travelBlock}
            direction={mode === "route-before" ? "before" : "after"}
            onBack={() => setMode("details")}
            onSearch={onDirectRouteSearch}
            onRegister={onDirectRouteRegister}
          />
        ) : mode === "edit" ? (
          <form className="add-item-form" onSubmit={handleSubmit}>
            <div className="modal-form-field"><label htmlFor="travel-edit-title">タイトル</label><input id="travel-edit-title" value={title} onChange={(event) => setTitle(event.target.value)} /></div>
            <div className="modal-date-fields"><DateTimePicker id="travel-edit-start" label="出発日時" value={startAt} onChange={setStartAt} /><DateTimePicker id="travel-edit-end" label="到着日時" value={endAt} min={startAt} onChange={setEndAt} /></div>
            <div className="modal-date-fields"><div className="modal-form-field"><label htmlFor="travel-edit-origin">出発地</label><input id="travel-edit-origin" value={origin} onChange={(event) => setOrigin(event.target.value)} /></div><div className="modal-form-field"><label htmlFor="travel-edit-destination">目的地</label><input id="travel-edit-destination" value={destination} onChange={(event) => setDestination(event.target.value)} /></div></div>
            <div className="modal-date-fields"><div className="modal-form-field"><label htmlFor="travel-edit-mode">交通手段</label><select id="travel-edit-mode" value={transportMode} onChange={(event) => setTransportMode(event.target.value)}><option value="TRANSIT">公共交通</option><option value="WALK">徒歩</option><option value="train">鉄道</option><option value="bus">バス</option><option value="flight">飛行機</option><option value="ferry">船</option><option value="car">車</option><option value="bike">自転車</option><option value="other">その他</option></select></div><div className="modal-form-field"><label htmlFor="travel-edit-booking">予約状態</label><select id="travel-edit-booking" value={bookingStatus} onChange={(event) => setBookingStatus(event.target.value)}><option value="planned">未予約・予定</option><option value="booked">予約済み</option></select></div></div>
            <div className="modal-form-field"><label htmlFor="travel-edit-trip">Trip</label><select id="travel-edit-trip" value={tripId} onChange={(event) => setTripId(event.target.value)}><option value="">関連付けない</option>{trips.map((trip) => <option value={trip.id} key={trip.id}>{trip.title}</option>)}</select></div>
            <div className="modal-form-field"><label htmlFor="travel-edit-memo">メモ</label><textarea id="travel-edit-memo" value={memo} onChange={(event) => setMemo(event.target.value)} /></div>
            <div className="modal-form-field"><label htmlFor="travel-edit-url">関連URL</label><input id="travel-edit-url" type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} /></div>
            {errorMessage && <p className="modal-error-message">{errorMessage}</p>}
            <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setMode("details")}>キャンセル</button><button className="primary-button" type="submit" disabled={isBusy}>保存</button></div>
          </form>
        ) : mode === "delete" ? (
          <div className="delete-confirmation"><p>この移動ブロックを削除しますか？</p>{errorMessage && <p className="modal-error-message">{errorMessage}</p>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setMode("details")}>キャンセル</button><button className="danger-button" type="button" onClick={handleDelete} disabled={isBusy}>削除</button></div></div>
        ) : (
          <div className="event-details-content">
            {travelBlock.needs_review && <div className="travel-review-warning" role="alert"><strong>要確認</strong>{(travelBlock.review_reasons ?? []).map((reason) => <span key={reason}>{REVIEW_LABELS[reason] ?? reason}</span>)}</div>}
            <dl className="event-detail-list"><div><dt>時刻</dt><dd>{formatTime(travelBlock.start_at)} → {formatTime(travelBlock.end_at)}</dd></div><div><dt>区間</dt><dd>{getPlaceLabel(travelBlock.origin)} → {getPlaceLabel(travelBlock.destination)}</dd></div><div><dt>交通手段</dt><dd>{travelBlock.transport_mode}</dd></div><div><dt>状態</dt><dd>{travelBlock.booking_status === "booked" ? "予約済み" : "未予約・予定"}</dd></div>{travelBlock.provider && <div><dt>経路提供元</dt><dd>{travelBlock.provider}{travelBlock.is_fallback ? "（fallback）" : ""}</dd></div>}</dl>
            {(travelBlock.notices ?? []).map((notice) => <p className="travel-notice" key={notice}>{notice}</p>)}
            {(travelBlock.segments ?? []).length > 0 && <div className="travel-segments">{travelBlock.segments.map((segment, index) => <div key={`${segment.departure_at}-${index}`}><strong>{segment.line_name || segment.type}</strong><span>{segment.from} → {segment.to}</span></div>)}</div>}
            {travelBlock.link_url && <a href={travelBlock.link_url} target="_blank" rel="noreferrer">予約・案内ページを開く ↗</a>}
            <div className="travel-plan-actions"><button className="route-search-button" type="button" onClick={() => setMode("route-before")}>前区間を検索</button><button className="route-search-button" type="button" onClick={() => setMode("route-after")}>後区間を検索</button></div>
            <div className="modal-actions event-details-actions"><button className="danger-secondary-button" type="button" onClick={() => setMode("delete")}>削除</button><button className="primary-button" type="button" onClick={() => setMode("edit")}>編集</button></div>
          </div>
        )}
      </section>
    </div>
  );
}

export default TravelBlockDetailsModal;
