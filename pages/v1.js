import { useState, useEffect, useRef } from "react";
import debounce from "lodash/debounce";
import axios from "axios";
import Head from "next/head";
import { favoriteCampsites } from "../common/helper";

const baseDelaySeconds = 3;

const yearFromTimestamp = (timestamp) => timestamp.slice(0, 4);
const monthFromTimestamp = (timestamp) => timestamp.slice(5, 7);
const dateFromTimestamp = (timestamp) => timestamp.slice(8, 10);

const days = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const saturdayToSunday = [days.sat, days.sun];
const fridayToSunday = [days.fri, ...saturdayToSunday];
const thursdayToSunday = [days.thu, ...fridayToSunday];

const isDay = (timestamp, daysArray) =>
  daysArray.includes(new Date(timestamp.slice(0, -1)).getDay());

const Home = () => {
  const initialCampgroundQuery = "";
  const initialCamgrounds = [];
  const initialCampgroundSelected = {};

  const initialCampsites = [];
  const initialCampsitesCount = 0;
  const initialCampsitesDays = [];

  const initialShowOnly = false;

  const [campgroundQuery, setCampgroundQuery] = useState(
    initialCampgroundQuery
  );
  const [campgroundResults, setCampgroundResults] = useState(initialCamgrounds);
  const [campgroundSelected, setCampgroundSelected] = useState(
    initialCampgroundSelected
  );

  const [campsites, setCampsites] = useState(initialCampsites);
  const [campsitesTotal, setCampsitesTotal] = useState(initialCampsitesCount);
  const [campsitesLoaded, setCampsitesLoaded] = useState(initialCampsitesCount);
  const [campsitesDays, setCampsitesDays] = useState(initialCampsitesDays);

  const [showOnlyWeekendDays, setShowOnlyWeekendDays] = useState(
    initialShowOnly
  );
  const [showOnlyFavoriteCampsites, setShowOnlyFavoriteCampsites] = useState(
    initialShowOnly
  );

  const handleCampgroundQueryChange = (e) => {
    setCampgroundQuery(e.target.value);
    setCampgroundSelected(initialCampgroundSelected);
    setCampgroundResults(initialCamgrounds);
  };

  const debouncedSearch = useRef(
    debounce((searchValue, cancelToken) => {
      if (searchValue !== initialCampgroundQuery) {
        axios
          .get(`api/campgrounds/${encodeURIComponent(searchValue)}`, {
            cancelToken,
          })
          .then((response) => {
            const results = response.data.inventory_suggestions;
            if (results) {
              setCampgroundResults(
                results
                  .filter((result) => result.entity_type === "campground")
                  .sort((a, b) => (a.name > b.name ? 1 : -1))
              );
            }
          })
          .catch(() => null);
      }
    }, 300),
    []
  );

  useEffect(() => {
    const cancelTokenSource = axios.CancelToken.source();
    debouncedSearch.current(campgroundQuery, cancelTokenSource.token);
    return () => cancelTokenSource.cancel();
  }, [campgroundQuery]);

  const latestCampgroundSelected = useRef(campgroundSelected);

  useEffect(() => {
    latestCampgroundSelected.current = campgroundSelected;
  }, [campgroundSelected]);

  const handleCampgroundClick = (campground) => {
    setCampgroundQuery(campground.name.toLowerCase());
    setCampgroundSelected(campground);
    setCampgroundResults(initialCamgrounds);

    axios
      .get(`api/campsites/${campground.entity_id}`)
      .then(async (response) => {
        const results = response.data.campsites;

        if (results) {
          setCampsitesTotal(results.length);
          setCampsites(results);

          const sleep = () => {
            return new Promise((resolve) => {
              setTimeout(
                resolve,
                1000 * baseDelaySeconds * (1 + Math.random())
              );
            });
          };

          for (const result of results) {
            await sleep();

            if (
              latestCampgroundSelected.current.entity_id !==
              result.parent_asset_id
            ) {
              break;
            }

            await axios
              .get(`api/availabilities/${result.campsite_id}`)
              .then((response) => {
                const result = response.data.availability;

                if (result) {
                  setCampsitesDays((previousValue) =>
                    Object.entries(result.availabilities).reduce(
                      (nextDays, availability) => {
                        const nextnextDays = nextDays;
                        const day = availability[0];
                        if (!nextnextDays.includes(day)) {
                          nextnextDays.push(day);
                          nextnextDays.sort((a, b) => (a > b ? 1 : -1));
                        }
                        return nextnextDays;
                      },
                      previousValue
                    )
                  );

                  setCampsites((previousValue) => {
                    const nextCampsites = previousValue;

                    nextCampsites[
                      nextCampsites.findIndex(
                        (campsite) =>
                          campsite.campsite_id === result.campsite_id
                      )
                    ].availabilities = result.availabilities;

                    return nextCampsites;
                  });

                  setCampsitesLoaded((previousValue) => previousValue + 1);
                }
              });
          }
        }
      });
  };

  const minutesRemaining = Math.ceil(
    ((campsitesTotal - campsitesLoaded) * 2 * baseDelaySeconds) / 60
  );

  const handleShowOnlyWeekendDaysToggle = () =>
    setShowOnlyWeekendDays(!showOnlyWeekendDays);

  const handleShowOnlyFavoriteCampsitesToggle = () =>
    setShowOnlyFavoriteCampsites(!showOnlyFavoriteCampsites);

  const handleReloadPageClick = () => {
    window.location.reload(false);
  };

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
          value={campgroundQuery}
          onChange={handleCampgroundQueryChange}
          autoComplete="off"
          className="input"
        />

        {!campgroundSelected.entity_type ? (
          campgroundResults.map((result) => (
            <div
              key={result.entity_id}
              onClick={() => {
                handleCampgroundClick(result);
              }}
              className="section pointer campground"
            >
              {result.name.toLowerCase()}
            </div>
          ))
        ) : (
          <div className="campground campground-results">
            <div className="section">
              {campsitesTotal === 0 ? (
                <React.Fragment>loading...</React.Fragment>
              ) : (
                <React.Fragment>
                  {campsitesLoaded} of {campsitesTotal} loaded
                  {campsitesLoaded === campsitesTotal
                    ? "!"
                    : `, ${minutesRemaining} minute${
                        minutesRemaining === 1 ? "" : "s"
                      } remaining`}
                </React.Fragment>
              )}
            </div>

            {campsitesDays.length > 0 && (
              <React.Fragment>
                <div
                  onClick={handleShowOnlyWeekendDaysToggle}
                  className="pointer section"
                >
                  {showOnlyWeekendDays
                    ? "showing weekend days"
                    : "showing all days"}
                </div>

                <div
                  onClick={handleShowOnlyFavoriteCampsitesToggle}
                  className="section pointer"
                >
                  {showOnlyFavoriteCampsites
                    ? "showing favorite campsites"
                    : "showing all campsites"}
                </div>

                <div className="campsite">
                  <div></div>

                  <div></div>

                  {campsitesDays
                    .filter((timestamp) =>
                      showOnlyWeekendDays
                        ? isDay(timestamp, thursdayToSunday)
                        : true
                    )
                    .map((timestamp, index) => {
                      const year = yearFromTimestamp(timestamp);
                      const month = monthFromTimestamp(timestamp);
                      const day = dateFromTimestamp(timestamp);

                      return (
                        <div key={timestamp}>
                          <div>
                            {!showOnlyWeekendDays &&
                            ((month === "01" && day === "01") ||
                              index === 0) ? (
                              year
                            ) : (
                              <React.Fragment>&nbsp;</React.Fragment>
                            )}
                          </div>

                          <div>
                            {day === "01" ||
                            index === 0 ||
                            (showOnlyWeekendDays &&
                              isDay(timestamp, fridayToSunday)) ? (
                              month
                            ) : (
                              <React.Fragment>&nbsp;</React.Fragment>
                            )}
                          </div>

                          <div>
                            {!showOnlyWeekendDays ||
                            (showOnlyWeekendDays &&
                              isDay(timestamp, fridayToSunday)) ? (
                              day
                            ) : (
                              <React.Fragment>&nbsp;</React.Fragment>
                            )}
                          </div>
                          {isDay(timestamp, saturdayToSunday) && <div>⭐</div>}
                        </div>
                      );
                    })}
                </div>

                {campsites
                  .filter((campsite) =>
                    showOnlyFavoriteCampsites
                      ? favoriteCampsites[campsite.parent_asset_id]?.includes(
                          campsite.name
                        )
                      : true
                  )
                  .map((campsite) => (
                    <div key={campsite.campsite_id} className="campsite">
                      <div>
                        {favoriteCampsites[campsite.parent_asset_id]?.includes(
                          campsite.name
                        )
                          ? "⭐"
                          : ""}
                      </div>

                      <div>
                        <a
                          href={`https://www.recreation.gov/camping/campsites/${campsite.campsite_id}`}
                        >
                          {campsite.name}
                        </a>
                      </div>

                      {campsite.availabilities ? (
                        Object.entries(campsite.availabilities)
                          .filter((availability) =>
                            showOnlyWeekendDays
                              ? isDay(availability[0], thursdayToSunday)
                              : true
                          )
                          .map((availability) => (
                            <div
                              key={availability[0]}
                              style={{
                                gridColumnStart:
                                  campsitesDays
                                    .filter((day) =>
                                      showOnlyWeekendDays
                                        ? isDay(day, thursdayToSunday)
                                        : true
                                    )
                                    .indexOf(availability[0]) + 3,
                              }}
                            >
                              {!showOnlyWeekendDays ||
                              (showOnlyWeekendDays &&
                                isDay(availability[0], fridayToSunday)) ? (
                                availability[1] === "Available" ? (
                                  isDay(availability[0], saturdayToSunday) ? (
                                    "🟣"
                                  ) : (
                                    "🔵"
                                  )
                                ) : (
                                  "⚫"
                                )
                              ) : (
                                <React.Fragment>&nbsp;</React.Fragment>
                              )}
                            </div>
                          ))
                      ) : (
                        <div>loading...</div>
                      )}
                    </div>
                  ))}

                <div
                  onClick={handleReloadPageClick}
                  className="section pointer back"
                >
                  back
                </div>
              </React.Fragment>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        body {
          font-family: "IBM Plex Sans", serif;
          background-color: #202124;
          color: #d8dbdd;
          padding: 8px;
        }
        .section {
          margin-bottom: 16px;
        }
        .pointer {
          cursor: pointer;
        }
        input {
          background-color: #575757;
          color: #d8dbdd;
          border-radius: 32px;
          padding: 16px 24px;
          margin-bottom: 16px;
          width: calc(100vw - 64px);
          border: none;
          font-size: 16px;
        }
        input:focus {
          outline: none;
        }
        .campground {
          margin-left: 24px;
        }
        .campsite {
          display: grid;
          grid-template-columns:
            [start
            star-start] 30px [star-end
            name-start] 150px [name-end
            days-start]
            repeat(${campsitesDays.length}, [day-start] 30px [day-end])
            [days-end
            end];
          grid-auto-rows: minmax(30px, auto);
        }
        .top-back {
          margin-top: 14px;
          margin-bottom: 32px;
        }
        .back {
          margin-top: 16px;
        }
        a {
          color: #d8dbdd;
          text-decoration: none;
        }
      `}</style>
    </div>
  );
};

export default Home;
