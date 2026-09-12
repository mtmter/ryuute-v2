import {
  WEEKDAY_NAMES,
  getDateKey,
  getWeekDates,
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

function WeekCalendar({
  events,
  travelBlocks,
  selectedDate,
  onEventClick,
  onTravelBlockClick,
  onTimeClick,
}) {
  const weekDates = getWeekDates(selectedDate);
  const today = new Date();

  return (
    <section aria-label="週間カレンダー">
      <div className="calendar-horizontal-scroll">
        <div className="week-calendar">
          <div className="week-header-row">
            <div className="week-corner" />
            {weekDates.map((date, index) => (
              <div className="week-date-heading" key={getDateKey(date)}>
                <span
                  className={
                    index === 0
                      ? "is-sunday"
                      : index === 6
                        ? "is-saturday"
                        : ""
                  }
                >
                  {WEEKDAY_NAMES[index]}
                </span>
                <time
                  className={isSameDay(date, today) ? "is-today" : ""}
                  dateTime={getDateKey(date)}
                >
                  {date.getDate()}
                </time>
              </div>
            ))}
          </div>

          <div className="week-time-scroll">
            <div
              className="week-time-grid"
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

              {weekDates.map((date) => {
                const dateItems = layoutCalendarItemsForDay(
                  [
                    ...events.map((event) => ({ ...event, calendar_kind: "event" })),
                    ...travelBlocks.map((block) => ({ ...block, calendar_kind: "travel" })),
                  ],
                  date,
                );

                return (
                  <div
                    className="week-day-column"
                    style={{ "--hour-height": `${HOUR_HEIGHT}px` }}
                    key={getDateKey(date)}
                    onClick={(event) => {
                      const columnRectangle =
                        event.currentTarget.getBoundingClientRect();
                      const clickedMinutes =
                        ((event.clientY - columnRectangle.top) / HOUR_HEIGHT) *
                        60;
                      const roundedMinutes = Math.min(
                        Math.max(Math.floor(clickedMinutes / 30) * 30, 0),
                        23 * 60 + 30,
                      );
                      onTimeClick(date, roundedMinutes);
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
                );
              })}
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}

export default WeekCalendar;
