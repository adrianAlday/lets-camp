import { useState, useRef, useEffect } from "react";
import debounce from "lodash/debounce";
import axios from "axios";
import { favoriteSites } from "../common/helper";
import Head from "next/head";

const baseDelaySeconds = 3;

const sleep = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 1000 * baseDelaySeconds * (1 + Math.random()));
  });

const yearMonthDayFromTimestamp = (timestamp) => [
  timestamp.slice(0, 4),
  timestamp.slice(5, 7),
  timestamp.slice(8, 10),
];

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
    campgroundCampsiteAvailabilityDays,
    setCampgroundCampsiteAvailabilityDays,
  ] = useState({});

  // ui

  const initialCampgroundIdIsSelected = false;

  const [campgroundIdIsSelected, setCampgroundIdIsSelected] = useState(
    initialCampgroundIdIsSelected
  );

  const initialSelectedCampgroundId = null;

  const [selectedCampgroundId, setSelectedCampgroundId] = useState(
    initialSelectedCampgroundId
  );

  // get campgrounds

  const handleCampgroundsQueryChange = (e) => {
    const { value } = e.target;
    setDisplayedCampgroundSearchQuery(value);
    setRequestedCampgroundSearchQuery(value);

    setCampgroundIdIsSelected(initialCampgroundIdIsSelected);
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
    setCampgroundIdIsSelected(!initialCampgroundIdIsSelected);
    setDisplayedCampgroundSearchQuery(campground.name.toLowerCase());

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
        const selectedCampgroundCampsites = JSON.parse(
          JSON.stringify(campgroundCampsites[selectedCampgroundId])
        );

        if (selectedCampgroundCampsites) {
          const selectedCampgroundFavoriteSites =
            favoriteSites[selectedCampgroundId];

          const sortedSelectedCampgroundCampsites = selectedCampgroundFavoriteSites
            ? selectedCampgroundCampsites.sort((a, b) =>
                selectedCampgroundFavoriteSites.includes(a.name) >
                selectedCampgroundFavoriteSites.includes(b.name)
                  ? -1
                  : 1
              )
            : selectedCampgroundCampsites;

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

                  setCampgroundCampsiteAvailabilityDays((previousValue) => {
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

        {!campgroundIdIsSelected &&
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

        <div className="days-grid day-labels">
          {campgroundCampsiteAvailabilityDays?.[selectedCampgroundId]?.map(
            (timestamp, index) => {
              const [year, month, day] = yearMonthDayFromTimestamp(timestamp);

              const style = {
                gridColumnStart:
                  campgroundCampsiteAvailabilityDays[
                    selectedCampgroundId
                  ].indexOf(timestamp) + 3,
              };

              return (
                <div key={timestamp} style={style}>
                  <div>
                    {(month === "01" && day === "01") || index === 0 ? (
                      year
                    ) : (
                      <React.Fragment>&nbsp;</React.Fragment>
                    )}
                  </div>

                  <div>
                    {day === "01" || index === 0 ? (
                      month
                    ) : (
                      <React.Fragment>&nbsp;</React.Fragment>
                    )}
                  </div>

                  <div>{day}</div>
                </div>
              );
            }
          )}
        </div>

        <div className="days-grid">
          {campgroundCampsites[selectedCampgroundId]?.map(
            (campgroundCampsite) => (
              <React.Fragment key={campgroundCampsite.campsite_id}>
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
                campgroundCampsiteAvailabilityDays?.[selectedCampgroundId] ? (
                  Object.entries(
                    campgroundCampsiteAvailabilities[selectedCampgroundId][
                      campgroundCampsite.campsite_id
                    ]
                  ).map((availability) => {
                    const day = availability[0];

                    const style = {
                      gridColumnStart:
                        campgroundCampsiteAvailabilityDays[
                          selectedCampgroundId
                        ].indexOf(day) + 3,
                    };

                    const copy = availability[1] === "Available" ? "🔵" : "⚫";

                    return (
                      <div
                        key={`${campgroundCampsite.campsite_id}-${day}`}
                        style={style}
                      >
                        {copy}
                      </div>
                    );
                  })
                ) : (
                  <div>loading...</div>
                )}
              </React.Fragment>
            )
          )}
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
        .campground-result {
          margin-left: 27px;
          margin-bottom: 27px;
        }
        .days-grid {
          display: grid;
          grid-template-columns:
            [star] 27px
            [name] 123px
            [days] repeat(
              ${campgroundCampsiteAvailabilityDays?.[selectedCampgroundId]
                ?.length || 1},
              27px
            );
          grid-auto-rows: minmax(27px, auto);
          margin-bottom: calc(27px / 2);
        }
        .day-labels {
          min-height: 60px;
        }
      `}</style>
    </div>
  );
};

export default Home;
