import { useMemo, useState } from "react";
import { analyzeTripItinerary, getPlaceLabel } from "../travelUtils";
import DateTimePicker from "./DateTimePicker";
import PreparationChecklist from "./PreparationChecklist";

const WARNING_LABELS = {
  gap: (warning) => `${warning.minutes}分の空きがあります`,
  overlap: () => "時間が重複しています",
  place_mismatch: () => "前後の場所が一致しません",
};

function TripDetailsModal({
  trip,
  events,
  travelBlocks,
  preparations,
  onClose,
  onDelete,
  onUpdate,
  onPreparationAdd,
  onPreparationDelete,
  onPreparationUpdate,
  onSelectEvent,
  onSelectTravelBlock,
}) {
  const [mode, setMode] = useState("details");
  const [deleteAction, setDeleteAction] = useState("keep");
  const [title, setTitle] = useState(trip.title);
  const [notes, setNotes] = useState(trip.notes ?? "");
  const [startAt, setStartAt] = useState(trip.start_at ?? "");
  const [endAt, setEndAt] = useState(trip.end_at ?? "");
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const itinerary = useMemo(
    () => analyzeTripItinerary(events, travelBlocks),
    [events, travelBlocks],
  );
  const sourceEvent = events.find(
    (event) => event.id === trip.source_event_id,
  );

  async function handleUpdate(event) {
    event.preventDefault();
    if (!title.trim()) {
      setErrorMessage("Tripタイトルを入力してください");
      return;
    }
    if (startAt && endAt && endAt < startAt) {
      setErrorMessage("終了日時は開始日時以降にしてください");
      return;
    }
    setIsBusy(true);
    try {
      await onUpdate(trip.id, {
        title: title.trim(),
        notes,
        start_at: startAt || null,
        end_at: endAt || null,
        source_event_id: trip.source_event_id ?? null,
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
      await onDelete(trip.id, deleteAction);
    } catch (error) {
      setErrorMessage(error.message);
      setIsBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose();
      }}
    >
      <section
        className="event-details-modal trip-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-detail-heading"
      >
        <div className="modal-header">
          <div>
            <p>Trip詳細</p>
            <h2 id="trip-detail-heading">
              {mode === "edit" ? "Tripを編集" : trip.title}
            </h2>
          </div>
          <button className="modal-close-button" type="button" onClick={onClose}>
            ×
          </button>
        </div>

        {mode === "edit" ? (
          <form className="add-item-form" onSubmit={handleUpdate}>
            <div className="modal-form-field">
              <label htmlFor="trip-edit-title">タイトル</label>
              <input id="trip-edit-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="modal-date-fields">
              <DateTimePicker id="trip-edit-start" label="開始日時" optional value={startAt} onChange={setStartAt} />
              <DateTimePicker id="trip-edit-end" label="終了日時" optional value={endAt} min={startAt} onChange={setEndAt} />
            </div>
            <div className="modal-form-field">
              <label htmlFor="trip-edit-notes">メモ</label>
              <textarea id="trip-edit-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
            {errorMessage && <p className="modal-error-message">{errorMessage}</p>}
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setMode("details")}>キャンセル</button>
              <button className="primary-button" type="submit" disabled={isBusy}>保存</button>
            </div>
          </form>
        ) : mode === "delete" ? (
          <div className="delete-confirmation">
            <p>Tripを削除しますか？</p>
            <label className="delete-choice">
              <input type="radio" name="trip-delete" checked={deleteAction === "keep"} onChange={() => setDeleteAction("keep")} />
              グループだけ削除（予定と移動は保持）
            </label>
            <label className="delete-choice">
              <input type="radio" name="trip-delete" checked={deleteAction === "delete"} onChange={() => setDeleteAction("delete")} />
              予定と移動も削除
            </label>
            {errorMessage && <p className="modal-error-message">{errorMessage}</p>}
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setMode("details")}>キャンセル</button>
              <button className="danger-button" type="button" onClick={handleDelete} disabled={isBusy}>削除</button>
            </div>
          </div>
        ) : (
          <div className="event-details-content">
            <p>{trip.notes || "メモはありません"}</p>
            {sourceEvent && (
              <div className="trip-source-event">
                <strong>原典予定</strong>
                <span>{sourceEvent.title}（カレンダーでは非表示）</span>
              </div>
            )}
            <section className="trip-itinerary">
              <h3>旅程</h3>
              {itinerary.items.length === 0 ? (
                <p>予定・移動はまだありません</p>
              ) : (
                <ol>
                  {itinerary.items.map((item) => (
                    <li key={`${item.calendar_kind}-${item.id}`}>
                      <button
                        type="button"
                        onClick={() =>
                          item.calendar_kind === "travel"
                            ? onSelectTravelBlock(item)
                            : onSelectEvent(item)
                        }
                      >
                        <span>{item.start_at?.replace("T", " ")}–{item.end_at?.slice(11, 16)}</span>
                        <strong>{item.calendar_kind === "travel" ? `⇢ ${item.title}` : item.title}</strong>
                        {item.calendar_kind === "travel" && <small>{getPlaceLabel(item.origin)} → {getPlaceLabel(item.destination)}</small>}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              {itinerary.warnings.length > 0 && (
                <div className="trip-warning-list">
                  <h4>旅程の確認事項</h4>
                  {itinerary.warnings.map((warning, index) => (
                    <p key={`${warning.type}-${index}`}>{WARNING_LABELS[warning.type](warning)}</p>
                  ))}
                </div>
              )}
            </section>
            <PreparationChecklist
              ownerType="trip"
              ownerId={trip.id}
              subjectLabel="Trip"
              preparations={preparations}
              onAdd={onPreparationAdd}
              onDelete={onPreparationDelete}
              onUpdate={onPreparationUpdate}
            />
            <div className="modal-actions event-details-actions">
              <button className="danger-secondary-button" type="button" onClick={() => setMode("delete")}>削除</button>
              <button className="primary-button" type="button" onClick={() => setMode("edit")}>編集</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default TripDetailsModal;
