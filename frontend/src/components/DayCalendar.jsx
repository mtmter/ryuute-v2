import {
  WEEKDAY_NAMES,
  getDateKey,
  isSameDay,
} from "../dateUtils";
import { layoutCalendarItemsForDay } from "../travelUtils";

const HOUR_HEIGHT = 56;

function formatMinutes(minutes) {
  if (minutes === 24 * 60) {
    return "24:00";
  }

  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

function DayCalendar({
  events,
  travelBlocks,
  selectedDate,
  onEventClick,
  onTravelBlockClick,
  onTimeClick,
}) {
  const today = new Date();
  const weekdayIndex = selectedDate.getDay();
  const dateItems = layoutCalendarItemsForDay(
    [
      ...events.map((event) => ({ ...event, calendar_kind: "event" })),
      ...travelBlocks.map((block) => ({ ...block, calendar_kind: "travel" })),
    ],
    selectedDate,
  );

  return (
    <section aria-label="日間カレンダー">
      <div className="calendar-horizontal-scroll">
        <div className="day-calendar">
          <div className="week-header-row day-header-row">
            <div className="week-corner" />
            <div className="week-date-heading">
              <span
                className={
                  weekdayIndex === 0
                    ? "is-sunday"
                    : weekdayIndex === 6
                      ? "is-saturday"
                      : ""
                }
              >
                {WEEKDAY_NAMES[weekdayIndex]}
              </span>
              <time
                className={isSameDay(selectedDate, today) ? "is-today" : ""}
                dateTime={getDateKey(selectedDate)}
              >
                {selectedDate.getDate()}
              </time>
            </div>
          </div>

          <div className="week-time-scroll">
            <div
              className="week-time-grid day-time-grid"
              style={{ height: `${24 * HOUR_HEIGHT}px` }}
            >
              <div className="week-hours" aria-hidden="true">
                {Array.from({ length: 24 }, (_, hour) => (
                  <span
                    style={{ top: `${hour * HOUR_HEIGHT}px` }}
                    key={hour}
                  >
                    {String(hour).padStart(2, "0")}:00
                  </span>
                ))}
              </div>

              <div
                className="week-day-column"
                style={{ "--hour-height": `${HOUR_HEIGHT}px` }}
                onClick={(event) => {
                  const columnRectangle =
                    event.currentTarget.getBoundingClientRect();
                  const clickedMinutes =
                    ((event.clientY - columnRectangle.top) / HOUR_HEIGHT) * 60;
                  const roundedMinutes = Math.min(
                    Math.max(Math.floor(clickedMinutes / 30) * 30, 0),
                    23 * 60 + 30,
                  );
                  onTimeClick(selectedDate, roundedMinutes);
                }}
              >
                {dateItems.map((item) => {
                  const { position } = item;
                  return (
                    <div
                      className={`week-event${item.calendar_kind === "travel" ? " week-travel-block" : ""}${item.needs_review ? " needs-review" : ""}${item.hasOverlap ? " has-overlap" : ""}`}
                      style={{
                        top: `${(position.startMinutes / 60) * HOUR_HEIGHT}px`,
                        height: `${Math.max(
                          (position.durationMinutes / 60) * HOUR_HEIGHT,
                          28,
                        )}px`,
                        left: `calc(${item.leftPercent}% + 2px)`,
                        width: `calc(${item.widthPercent}% - 4px)`,
                        right: "auto",
                      }}
                      title={`${item.title}${item.hasOverlap ? "（時間が重複しています）" : ""}`}
                      key={`${item.calendar_kind}-${item.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        if (item.calendar_kind === "travel") onTravelBlockClick(item);
                        else onEventClick(item);
                      }}
                      onKeyDown={(keyEvent) => {
                        if (
                          keyEvent.key === "Enter" ||
                          keyEvent.key === " "
                        ) {
                          keyEvent.preventDefault();
                          keyEvent.stopPropagation();
                          if (item.calendar_kind === "travel") onTravelBlockClick(item);
                          else onEventClick(item);
                        }
                      }}
                    >
                      <strong>{item.calendar_kind === "travel" ? `⇢ ${item.title}` : `${item.source === "google_calendar" ? "G " : ""}${item.title}`}</strong>
                      <span>
                        {formatMinutes(position.startMinutes)}–
                        {formatMinutes(
                          position.startMinutes + position.durationMinutes,
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default DayCalendar;
