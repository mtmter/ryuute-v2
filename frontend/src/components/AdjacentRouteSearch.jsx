import { useState } from "react";
import { getPlaceLabel } from "../travelUtils";
import PlaceAutocompleteInput from "./PlaceAutocompleteInput";
import RouteSearchResult from "./RouteSearchResult";

function AdjacentRouteSearch({ anchor, direction, onBack, onRegister, onSearch }) {
  const [placeText, setPlaceText] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [route, setRoute] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const isBefore = direction === "before";

  function externalPlace() {
    return selectedPlace
      ? {
          name: selectedPlace.name || placeText.trim(),
          address: selectedPlace.address || null,
          place_id: selectedPlace.place_id || null,
          lat: selectedPlace.lat ?? null,
          lng: selectedPlace.lng ?? null,
        }
      : { name: placeText.trim(), address: null, place_id: null, lat: null, lng: null };
  }

  function request() {
    const place = externalPlace();
    return {
      origin: isBefore ? place : anchor.destination,
      destination: isBefore ? anchor.origin : place,
      timing: {
        type: isBefore ? "arrival" : "departure",
        at: isBefore ? anchor.start_at : anchor.end_at,
      },
    };
  }

  async function handleSearch(event) {
    event.preventDefault();
    if (!placeText.trim()) {
      setErrorMessage(isBefore ? "前区間の出発地を入力してください" : "後区間の目的地を入力してください");
      return;
    }
    setIsBusy(true);
    setErrorMessage("");
    try { setRoute(await onSearch(request())); }
    catch (error) { setErrorMessage(error.message); }
    finally { setIsBusy(false); }
  }

  async function handleRegister(result) {
    setIsBusy(true);
    try { await onRegister(result, { ...request(), tripId: anchor.trip_id }); }
    catch (error) { setErrorMessage(error.message); setIsBusy(false); }
  }

  if (route) {
    return <RouteSearchResult route={route} errorMessage={errorMessage} isRegistering={isBusy} onRegister={handleRegister} onRetry={() => setRoute(null)} />;
  }

  return <form className="route-search-form" onSubmit={handleSearch}>
    <p>{isBefore ? `${getPlaceLabel(anchor.origin)}へ到着する前区間` : `${getPlaceLabel(anchor.destination)}から出発する後区間`}を検索します。</p>
    <div className="modal-form-field"><label htmlFor="adjacent-route-place">{isBefore ? "出発地" : "目的地"}</label><PlaceAutocompleteInput id="adjacent-route-place" value={placeText} autoFocus disabled={isBusy} onChange={(value) => { setPlaceText(value); setSelectedPlace(null); }} onPlaceSelect={(place) => { setSelectedPlace(place); if (place) setPlaceText(place.name); }} /></div>
    {errorMessage && <p className="modal-error-message">{errorMessage}</p>}
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={onBack}>戻る</button><button className="primary-button" type="submit" disabled={isBusy}>{isBusy ? "検索中..." : "検索する"}</button></div>
  </form>;
}

export default AdjacentRouteSearch;
