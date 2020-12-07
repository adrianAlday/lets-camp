import { useState, useRef, useEffect } from "react";
import debounce from "lodash/debounce";
import axios from "axios";
import { daysOfWeek, favoriteCampsites } from "../common/helper";
import Head from "next/head";

// consistent use of day date timestamp

const baseDelaySeconds = 3;

const sleep = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 1000 * baseDelaySeconds * (1 + Math.random()));
  });

const saturdayToSunday = [daysOfWeek.sat, daysOfWeek.sun];
const fridayToSunday = [daysOfWeek.fri, ...saturdayToSunday];
const thursdayToSunday = [daysOfWeek.thu, ...fridayToSunday];

const isInDayRange = (timestamp, daysArray) =>
  daysArray.includes(new Date(timestamp.slice(0, -1)).getDay());

const Home = () => {
  // state

  // search

  const initialCampgroundSearchQuery = "";

  const [
    displayedCampgroundSearchQuery,
    setDisplayedCampgroundSearchQuery,
  ] = useState(initialCampgroundSearchQuery);
  const [
    requestedCampgroundSearchQuery,
    setRequestedCampgroundSearchQuery,
  ] = useState(initialCampgroundSearchQuery);

  const [campgroundSearchResults, setCampgroundSearchResults] = useState([]);

  // data

  const [campgroundCampsites, setCampgroundCampsites] = useState({});
  const [
    campgroundCampsiteAvailabilities,
    setCampgroundCampsiteAvailabilities,
  ] = useState({});
  const [
    campgroundCampsiteAvailabilityDates,
    setCampgroundCampsiteAvailabilityDates,
  ] = useState({});

  // ui

  const initialCampgroundIdIsSelected = false;

  const [isCampgroundSelected, setIsCampgroundSelected] = useState(
    initialCampgroundIdIsSelected
  );

  const initialSelectedCampgroundId = null;

  const [selectedCampgroundId, setSelectedCampgroundId] = useState(
    initialSelectedCampgroundId
  );

  const initialShowOnly = false;

  const [showOnlyWeekendDays, setShowOnlyWeekendDays] = useState(
    initialShowOnly
  );
  const [showOnlyFavoriteCampsites, setShowOnlyFavoriteCampsites] = useState(
    initialShowOnly
  );

  // get campgrounds

  const handleCampgroundsQueryChange = (e) => {
    const { value } = e.target;
    setDisplayedCampgroundSearchQuery(value);
    setRequestedCampgroundSearchQuery(value);

    setIsCampgroundSelected(initialCampgroundIdIsSelected);
    setSelectedCampgroundId(initialSelectedCampgroundId);
  };

  const debouncedSearch = useRef(
    debounce((query, cancelToken) => {
      if (query !== initialCampgroundSearchQuery) {
        axios
          .get(`api/campgrounds/${encodeURIComponent(query)}`, {
            cancelToken,
          })
          .then((response) => {
            const results = response?.data?.inventory_suggestions;

            if (results) {
              setCampgroundSearchResults(
                results
                  .filter((result) => result?.entity_type === "campground")
                  .sort((a, b) => (a?.name > b?.name ? 1 : -1))
              );
            }
          });
      }
    }, 300),
    []
  );

  useEffect(() => {
    const cancelTokenSource = axios.CancelToken.source();

    debouncedSearch.current(
      requestedCampgroundSearchQuery,
      cancelTokenSource.token
    );

    return () => cancelTokenSource.cancel();
  }, [requestedCampgroundSearchQuery]);

  // get campground campsites

  const handleCampgroundResultClick = (campground) => {
    setIsCampgroundSelected(!initialCampgroundIdIsSelected);
    setDisplayedCampgroundSearchQuery(campground.name.toLowerCase());
    setShowOnlyWeekendDays(initialShowOnly);
    setShowOnlyFavoriteCampsites(initialShowOnly);

    const campgroundId = campground.entity_id;

    axios.get(`api/campsites/${campgroundId}`).then(async (response) => {
      await setCampgroundCampsites((previousValue) => ({
        ...previousValue,
        [campgroundId]: response?.data?.campsites || {},
      }));

      setSelectedCampgroundId(campgroundId);
    });
  };

  // get campground campsite availabilities

  useEffect(() => {
    const abortController = new AbortController();

    if (selectedCampgroundId !== initialSelectedCampgroundId) {
      const getAvailabilities = async () => {
        const selectedCampgroundCampsites =
          campgroundCampsites[selectedCampgroundId];

        if (selectedCampgroundCampsites) {
          const copyOfSelectedCampgroundCampsites = JSON.parse(
            JSON.stringify(selectedCampgroundCampsites)
          );

          const selectedCampgroundFavoriteSites =
            favoriteCampsites[selectedCampgroundId];

          // if site has no data, fetch it first

          const sortedSelectedCampgroundCampsites = selectedCampgroundFavoriteSites
            ? copyOfSelectedCampgroundCampsites.sort((a, b) =>
                selectedCampgroundFavoriteSites.includes(a.name) >
                selectedCampgroundFavoriteSites.includes(b.name)
                  ? -1
                  : 1
              )
            : copyOfSelectedCampgroundCampsites;

          for (const campgroundCampsite of sortedSelectedCampgroundCampsites) {
            await sleep();

            const campsiteId = campgroundCampsite.campsite_id;

            await axios
              .get(`api/availabilities/${campsiteId}`)
              .then((response) => {
                const availabilities =
                  response?.data?.availability?.availabilities;

                if (availabilities) {
                  const campgroundId = campgroundCampsite.parent_asset_id;

                  setCampgroundCampsiteAvailabilities((previousValue) => {
                    const previousCampgroundIdAvailabilities =
                      previousValue[campgroundId] || {};

                    const nextCampgroundIdAvailabilities = {
                      ...previousCampgroundIdAvailabilities,
                      [campsiteId]: availabilities,
                    };

                    return {
                      ...previousValue,
                      [campgroundId]: nextCampgroundIdAvailabilities,
                    };
                  });

                  setCampgroundCampsiteAvailabilityDates((previousValue) => {
                    const previousCampgroundIdAvailabilityDays =
                      previousValue[campgroundId] || [];

                    const nextCampgroundIdAvailabilityDays = Object.keys(
                      availabilities
                    )
                      .reduce((accumulator, day) => {
                        if (!accumulator.includes(day)) {
                          accumulator.push(day);
                        }

                        return accumulator;
                      }, previousCampgroundIdAvailabilityDays)
                      .sort((a, b) => (a > b ? 1 : -1));

                    return {
                      ...previousValue,
                      [campgroundId]: nextCampgroundIdAvailabilityDays,
                    };
                  });
                }
              });

            if (abortController.signal.aborted) {
              break;
            }
          }
        }
      };

      getAvailabilities();
    }

    return () => {
      abortController.abort();
    };
  }, [selectedCampgroundId]);

  const handleShowDaysToggle = () =>
    setShowOnlyWeekendDays(!showOnlyWeekendDays);

  const handleShowCampsitesToggle = () =>
    setShowOnlyFavoriteCampsites(!showOnlyFavoriteCampsites);

  const showingAllOrIsInDayRange = (timestamp, daysArray) =>
    !showOnlyWeekendDays || isInDayRange(timestamp, daysArray);

  const blankSpace = () => <React.Fragment>&nbsp;</React.Fragment>;

  return (
    <div>
      <Head>
        <title>lets camp 🏕️</title>

        <link rel="icon" href="/favicon.ico" />

        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css?family=IBM+Plex+Sans"
        />
      </Head>

      <div>
        <input
          type="text"
          value={displayedCampgroundSearchQuery}
          onChange={handleCampgroundsQueryChange}
          autoComplete="off"
        />

        {!isCampgroundSelected &&
          campgroundSearchResults.map((campgroundResult) => (
            <div
              key={campgroundResult.entity_id}
              className="campground-result"
              onClick={() => {
                handleCampgroundResultClick(campgroundResult);
              }}
            >
              {campgroundResult.name.toLowerCase()}
            </div>
          ))}

        {campgroundCampsites[selectedCampgroundId] && (
          <React.Fragment>
            <div className="toggle" onClick={handleShowDaysToggle}>
              {campgroundCampsiteAvailabilityDates[selectedCampgroundId]
                ? showOnlyWeekendDays
                  ? "showing weekend days"
                  : "showing all days"
                : blankSpace()}
            </div>

            {favoriteCampsites[selectedCampgroundId] && (
              <div
                className="toggle"
                onClick={handleShowCampsitesToggle}
              >
                {showOnlyFavoriteCampsites
                  ? "showing favorite campsites"
                  : "showing all campsites"}
              </div>
            )}
          </React.Fragment>
        )}

        <div className="days-grid date-labels">
          {campgroundCampsiteAvailabilityDates[selectedCampgroundId]
            ?.filter((timestamp) =>
              showingAllOrIsInDayRange(timestamp, thursdayToSunday)
            )
            .map((timestamp, index) => {
              const [year, month, date] = [
                timestamp.slice(0, 4),
                timestamp.slice(5, 7),
                timestamp.slice(8, 10),
              ];

              const style = {
                gridColumnStart: index + 3,
              };

              return (
                <div key={timestamp} style={style}>
                  {showingAllOrIsInDayRange(timestamp, fridayToSunday) ? (
                    <React.Fragment>
                      <div>
                        {!showOnlyWeekendDays &&
                        ((month === "01" && date === "01") || index === 0)
                          ? year
                          : blankSpace()}
                      </div>

                      <div>
                        {showOnlyWeekendDays || date === "01" || index === 0
                          ? month
                          : blankSpace()}
                      </div>

                      <div>{date}</div>

                      <div>
                        {isInDayRange(timestamp, saturdayToSunday)
                          ? "⭐"
                          : blankSpace()}
                      </div>
                    </React.Fragment>
                  ) : (
                    blankSpace()
                  )}
                </div>
              );
            })}
        </div>

        <div className="days-grid">
          {campgroundCampsites[selectedCampgroundId]
            ?.filter((campgroundCampsite) =>
              showOnlyFavoriteCampsites
                ? favoriteCampsites[selectedCampgroundId]?.includes(
                    campgroundCampsite.name
                  )
                : true
            )
            .map((campgroundCampsite) => (
              <React.Fragment key={campgroundCampsite.campsite_id}>
                <div
                  style={{
                    gridColumnStart: 1,
                  }}
                >
                  {favoriteCampsites[selectedCampgroundId]?.includes(
                    campgroundCampsite.name
                  )
                    ? "⭐"
                    : ""}
                </div>

                <div
                  style={{
                    gridColumnStart: 2,
                  }}
                >
                  {campgroundCampsite.name.toLowerCase()}
                </div>

                {campgroundCampsiteAvailabilities?.[selectedCampgroundId]?.[
                  campgroundCampsite.campsite_id
                ] &&
                campgroundCampsiteAvailabilityDates?.[selectedCampgroundId] ? (
                  Object.entries(
                    campgroundCampsiteAvailabilities[selectedCampgroundId][
                      campgroundCampsite.campsite_id
                    ]
                  )
                    .filter(([day, _status]) =>
                      showingAllOrIsInDayRange(day, thursdayToSunday)
                    )
                    .map(([day, status]) => {
                      const key = `${campgroundCampsite.campsite_id}-${day}`;

                      const style = {
                        gridColumnStart:
                          campgroundCampsiteAvailabilityDates[
                            selectedCampgroundId
                          ]
                            .filter((day) =>
                              showingAllOrIsInDayRange(day, thursdayToSunday)
                            )
                            .indexOf(day) + 3,
                      };

                      const copy = showingAllOrIsInDayRange(day, fridayToSunday)
                        ? status === "Available"
                          ? isInDayRange(day, saturdayToSunday)
                            ? "🟣"
                            : "🔵"
                          : "⚫"
                        : blankSpace();

                      return (
                        <div key={key} style={style}>
                          {copy}
                        </div>
                      );
                    })
                ) : (
                  <div>loading...</div>
                )}
              </React.Fragment>
            ))}
        </div>
      </div>

      <style jsx global>{`
        body {
          font-family: "IBM Plex Sans", serif;
          background-color: #202124;
          color: #d8dbdd;
          padding: 8px;

      `}</style>

      <style jsx>{`
        input {
          background-color: #575757;
          color: #d8dbdd;
          padding: 18px 27px;
          border-radius: 27px;
          margin-bottom: 18px;
          width: calc(100vw - 2 * 27px - 4 * 8px);
          border: none;
          font-size: 16px;
        }
        input:focus {
          outline: none;
        }
        .campground-result,
        .toggle {
          margin-left: 27px;
          margin-bottom: 27px;
        }
        .days-grid {
          display: grid;
          grid-template-columns:
            [star] 27px
            [name] 123px
            [days] repeat(
              ${campgroundCampsiteAvailabilityDates?.[selectedCampgroundId]
                ?.length || 1},
              27px
            );
          grid-auto-rows: minmax(27px, auto);
          margin-bottom: calc(27px / 2);
        }
        .date-labels {
          min-height: 60px;
        }
      `}</style>
    </div>
  );
};

export default Home;
