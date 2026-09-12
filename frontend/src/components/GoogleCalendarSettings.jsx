function GoogleCalendarSettings({
  calendars = [],
  selectedIds = [],
  status = "disconnected",
  errorMessage = "",
  onConnect,
  onDisconnect,
  onSelectionChange,
  onSync,
}) {
  const connected = status === "connected" || status === "syncing";

  return (
    <section className="google-calendar-settings" aria-label="Google Calendar連携">
      <div className="google-calendar-settings-heading">
        <strong>Google Calendar</strong>
        {connected ? (
          <button type="button" onClick={onDisconnect}>切断</button>
        ) : (
          <button type="button" onClick={onConnect}>
            {status === "reconnect" ? "再接続" : "接続"}
          </button>
        )}
      </div>
      {connected && (
        <>
          <div className="google-calendar-list">
            {calendars.map((calendar) => (
              <label key={calendar.id}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(calendar.id)}
                  onChange={(event) => {
                    const nextIds = event.target.checked
                      ? [...selectedIds, calendar.id]
                      : selectedIds.filter((id) => id !== calendar.id);
                    onSelectionChange(nextIds);
                  }}
                />
                {calendar.summary}{calendar.primary ? "（メイン）" : ""}
              </label>
            ))}
          </div>
          <button type="button" disabled={status === "syncing" || selectedIds.length === 0} onClick={onSync}>
            {status === "syncing" ? "同期中…" : "今すぐ同期"}
          </button>
        </>
      )}
      {status === "reconnect" && <p>同期を再開するにはGoogle Calendarへ再接続してください。</p>}
      {errorMessage && <p className="modal-error-message" role="alert">{errorMessage}</p>}
    </section>
  );
}

export default GoogleCalendarSettings;
