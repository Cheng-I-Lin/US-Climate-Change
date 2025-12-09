import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import scrollama from "https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm";

// config
const WIDTH = 1000,
  HEIGHT = 600;

const svg = d3
  .select("#chart")
  .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
  .style("overflow", "hidden");

const tooltip = d3.select("#tooltip");
//const stateName = document.querySelector("#state-name");

const geoURL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
//"https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";
const dataURL = "combined_data.csv";

//var plotName;
var isSelected = false;
//var legendVisible = true;
let updateYearLineGlobal = null;
var enableUser = false;
//const slideNum = d3.select('#mainText').selectAll('div').nodes().length;
//const slides = Array.from({ length: slideNum }, (_, i) => i + 1);
var currentSlide = 0;
//Use previousSlide to decide when to trigger tranistion
var previousSlide = -1;
var storyScenario = "SSP245";
var diffLegend = false;
const northStates = [
  "Washington",
  "Idaho",
  "Montana",
  "North Dakota",
  "South Dakota",
  "Wyoming",
  "Oregon",
  "Nebraska",
  "Minnesota",
  "Iowa",
  "Wisconsin",
  "Michigan",
  "Missouri",
  "Illinois",
  "Indiana",
  "Ohio",
  "Kentucky",
  "West Virginia",
  "Virginia",
  "Pennsylvania",
  "New York",
  "Vermont",
  "Nevada",
  "Utah",
  "Colorado",
  "North Carolina",
];
const southStates = [
  "California",
  "Arizona",
  "Texas",
  "Louisiana",
  "Mississippi",
  "Alabama",
  "Kansas",
  "Oklahoma",
  "Arkansas",
];
const northeastStates = [
  "New Jersey",
  "Connecticut",
  "Massachusetts",
  "New Hampshire",
  "Maine",
  "Maryland",
];
const storyState = [
  "New Mexico",
  "Georgia",
  "Rhode Island",
  "South Carolina",
  "Delaware",
  "Tennessee",
  "Florida",
];

let northData, southData, northeastData, storyData;
let northAvg, southAvg, northeastAvg;

// Store original transform state
let currentZoomState = null;
let currentStateData = null;
let zoomGraph = false;

let brushExtent = null;
let isBrush = true;

//console.log(currentSlide);

const root = document.documentElement;

const color = d3
  .scaleThreshold()
  .domain([3, 6, 9, 12, 15, 18, 21, 24])
  .range(d3.schemeRdYlBu[9].reverse());

const customColors = [
  "white",
  "#fee0d2",
  "#fcbba1",
  "#fc9272",
  "#fb6a4a",
  "#ef3b2c",
];
const diffColor = d3
  .scaleThreshold()
  .domain([0, 0.5, 1, 1.5, 2])
  .range(customColors);

Promise.all([d3.json(geoURL), d3.csv(dataURL)]).then(([geo, data]) => {
  data.forEach((d) => {
    d.tas_degree = +d.tas_degree;
    d.pr = +d.pr;
    d.prsn = +d.prsn;
    d.mrsos = +d.mrsos;
    d.year = +d.year;
  });

  const models = Array.from(new Set(data.map((d) => d.model)));
  const modelSelect = d3.select("#modelSelect");
  modelSelect
    .selectAll("option")
    .data(models)
    .join("option")
    .text((d) => d);

  const scenarios = Array.from(new Set(data.map((d) => d.scenario)));
  const scenarioSelect = d3.select("#scenarioSelect");
  scenarioSelect
    .selectAll("option")
    .data(scenarios)
    .join("option")
    .text((d) => d);

  //const usSeriesByModel = {};
  /*for (const s of scenarios) {
    for (const m of models) {
      const arr = data.filter((d) => d.scenario === s && d.model === m);
      const rolled = d3.rollups(
        arr,
        //(v) => v.tas_degree,
        (v) => d3.mean(v, (d) => d.tas_degree),
        (d) => d.year
      );
      usSeriesByModel[s + m] = rolled
        .map(([year, mean]) => ({ year: +year, mean: +mean }))
        .sort((a, b) => a.year - b.year);
    }
  }*/

  const years = Array.from(new Set(data.map((d) => d.year))).sort(
    (a, b) => a - b
  );
  d3.select("#yearSlider")
    .attr("min", years[1] - 1) //Makes -1 all year
    .attr("max", years[years.length - 1])
    .attr("value", years[0]);
  d3.select("#yearLabel").text(years[0]);

  const statesGeo = topojson.feature(geo, geo.objects.states);

  const mainlandStates = statesGeo.features.filter((feature) => {
    const name = feature.properties.name || feature.properties.NAME;
    return name !== "Alaska" && name !== "Puerto Rico" && name !== "Hawaii";
  });
  const mainlandGeo = {
    type: "FeatureCollection",
    features: mainlandStates,
  };
  const projection = d3.geoAlbersUsa().fitSize([WIDTH, HEIGHT], mainlandGeo);
  const path = d3.geoPath().projection(projection);

  //makeLegend(color);

  const g = svg.append("g");
  //.attr("transform", `scale(1, -1) translate(0, -${HEIGHT})`);

  let legendHover;
  const states = g
    .selectAll("path")
    .data(mainlandStates)
    .join("path")
    .attr("d", path)
    .attr("stroke", "black")
    .attr("stroke-width", 0.5)
    .attr("class", "states")
    .attr("id", (d) => d.properties.name.replace(/\s/g, ""))
    .on("mouseenter", (event) => {
      hoverOver(event.currentTarget);
      let hoverColor = event.currentTarget.getAttribute("fill");
      d3.select("#legend")
        .selectAll("rect")
        .nodes()
        .forEach((d) => {
          if (d.getAttribute("fill") === hoverColor) {
            hoverOver(d);
            legendHover = d;
          }
        });
    })
    .on("mouseleave", (event) => {
      hoverOut(event.currentTarget);
      if (legendHover) hoverOut(legendHover);
    });

  function createAvg(filteredData) {
    // Group by year and calculate averages for each column
    const groupedByYear = d3.rollup(
      filteredData,
      (values) => ({
        tas_degree: d3.mean(values, (d) => d.tas_degree),
        pr: d3.mean(values, (d) => d.pr),
        prsn: d3.mean(values, (d) => d.prsn),
        mrsos: d3.mean(values, (d) => d.mrsos),
        count: values.length,
      }),
      (d) => d.year
    );

    // Convert to array with column format
    return Array.from(groupedByYear, ([year, stats]) => ({
      year: +year, // Convert year to number
      tas_degree: stats.tas_degree,
      pr: stats.pr,
      prsn: stats.prsn,
      mrsos: stats.mrsos,
      count: stats.count, // Optional: keep count of data points
    })).sort((a, b) => a.year - b.year);
  }

  northData = data.filter(
    (d) =>
      northStates.includes(d.state) &&
      d.year !== -1 &&
      d.scenario === "Overall Difference" &&
      d.model === "All Models"
  );
  northAvg = createAvg(northData);

  southData = data.filter(
    (d) =>
      southStates.includes(d.state) &&
      d.year !== -1 &&
      d.scenario === "Overall Difference" &&
      d.model === "All Models"
  );
  southAvg = createAvg(southData);

  northeastData = data.filter(
    (d) =>
      northeastStates.includes(d.state) &&
      d.year !== -1 &&
      d.scenario === "Overall Difference" &&
      d.model === "All Models"
  );
  northeastAvg = createAvg(northeastData);

  storyData = data.filter(
    (d) =>
      storyState.includes(d.state) &&
      d.year !== -1 &&
      d.scenario === "Overall Difference" &&
      d.model === "All Models"
  );

  //   d3.select('#chart').selectAll('path').nodes().forEach((d)=>{
  //     console.log(d);
  //   });

  function update() {
    const model = modelSelect.node().value;
    const scenario = scenarioSelect.node().value;
    const year = +d3.select("#yearSlider").node().value;
    let yearValue = year;

    if (diffLegend || (enableUser && scenario === "Overall Difference")) {
      makeLegend(diffColor);
    } else {
      makeLegend(color);
    }

    if (year === years[1] - 1) {
      d3.select("#yearLabel").text("All Years");
      yearValue = -1;
    } else {
      d3.select("#yearLabel").text(year);
    }

    let filtered = data.filter(
      (d) =>
        d.scenario === storyScenario &&
        d.model === "All Models" &&
        d.year === -1
    );

    if (enableUser) {
      filtered = data.filter(
        (d) =>
          d.scenario === scenario && d.model === model && d.year === yearValue
      );
    }

    const lookup = {};
    filtered.forEach((d) => (lookup[d.state] = d.tas_degree));

    //Maybe move code outside of update loop to run only once, and set an unique color so it doesn't depend on lookup/filtered
    const filteredExceptionLookup = Object.fromEntries(
      Object.entries(lookup).filter(([key]) => storyState.includes(key))
    );
    const filteredNorthLookup = Object.fromEntries(
      Object.entries(lookup).filter(([key]) => northStates.includes(key))
    );
    const filteredSouthLookup = Object.fromEntries(
      Object.entries(lookup).filter(([key]) => southStates.includes(key))
    );
    const filteredNortheastLookup = Object.fromEntries(
      Object.entries(lookup).filter(([key]) => northeastStates.includes(key))
    );
    states
      .style("fill-opacity", 0.7)
      .attr("fill", (d) => {
        if ([0, 4, 19].includes(currentSlide)) {
          return "#ccc";
        }
        const name = d.properties.name;
        if (
          currentSlide === 3 ||
          (enableUser && scenario === "Overall Difference")
        ) {
          return lookup[name] ? diffColor(lookup[name]) : "#ccc";
        } else {
          if ([5, 6].includes(currentSlide)) {
            //Colors only the selected states
            return Object.keys(filteredNorthLookup).includes(name)
              ? "rgb(245, 101, 87)"
              : "#ccc";
          } else if ([7, 8].includes(currentSlide)) {
            return Object.keys(filteredSouthLookup).includes(name)
              ? "rgb(245, 101, 87)"
              : "#ccc";
          } else if ([9, 10].includes(currentSlide)) {
            return Object.keys(filteredNortheastLookup).includes(name)
              ? "rgb(245, 101, 87)"
              : "#ccc";
          } else if (currentSlide >= 11 && currentSlide <= 18) {
            return Object.keys(filteredExceptionLookup).includes(name)
              ? "rgb(245, 101, 87)"
              : "#ccc";
          } else {
            return lookup[name] ? color(lookup[name]) : "#ccc";
          }
        }
      })
      .on("mouseover", (event, d) => {
        const name = d.properties.name;
        const val = lookup[name];
        if (
          ((currentSlide != 0 && currentSlide <= 3) || currentSlide == 20) &&
          !isSelected
        ) {
          tooltip
            .style("display", "block")
            .style("left", event.offsetX + 5 + "px")
            .style("top", event.offsetY + 5 + "px")
            .html(
              `<b>${name}</b><br>${val ? val.toFixed(2) + " °C" : "No Data"}`
            );
          console.log(val);
          console.log(name);
        }
      })
      .on("mouseout", () => tooltip.style("display", "none"))
      .on("click", (event, d) => {
        //const usSeries = usSeriesByModel[scenario + model];
        if (enableUser) {
          if (event.currentTarget.getAttribute("fill") != "#ccc") {
            const name = d.properties.name;
            currentStateData = data.filter(
              (d) =>
                d.state === name &&
                d.year !== -1 &&
                d.scenario === scenario &&
                d.model === model
            );
            if (!isSelected) {
              createSummaryStats(currentStateData);
            }
            zoomInState(d, event.currentTarget);
            selectState();
          }
        }
      });
    d3.select("#stats").on("click", () => {
      //createGraphButtons();
      if (enableUser || (currentSlide >= 12 && currentSlide <= 18)) {
        createStateVisualizations(currentStateData, currentZoomState);
        d3.select("#stats").style("opacity", 0).style("display", "none");
        d3.select("#graphButtons")
          .style("opacity", 1)
          .style("display", "block");
      }
    });
  }

  //const flipTransform = `scale(1, -1) translate(0, -${HEIGHT})`;

  // Zoom to state function
  function zoomInState(selectedState, clickedElement) {
    const stateName = selectedState.properties.name;

    // If clicking the same state, reset zoom
    if (currentZoomState === stateName) {
      resetZoom();
      return;
    }

    // Get the bounds of the selected state
    const bounds = path.bounds(selectedState);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;
    const scale = Math.max(
      1,
      Math.min(8, 0.9 / Math.max(dx / WIDTH, dy / HEIGHT))
    );

    // Calculate the translate to center the selected state
    const translate = [WIDTH / 2 - scale * x, HEIGHT / 2 - scale * y];

    if (!isSelected) {
      // Apply fade to all states
      g.selectAll(".states").classed("faded", true).classed("zoomed", false);

      // Highlight selected state
      d3.select(clickedElement).classed("faded", false).classed("zoomed", true);

      // Create zoom transition
      g.transition().duration(1000).attr(
        "transform",
        //`${flipTransform} translate(${translate[0]},${translate[1]}) scale(${scale})`
        `translate(${translate[0]},${translate[1]}) scale(${scale})`
      );
      currentZoomState = stateName;
      isSelected = true;
    }
  }

  // Reset zoom function
  function resetZoom() {
    if (isSelected) {
      d3.selectAll(".state-visualization, .close-btn").remove();
      g.selectAll(".states").classed("faded", false).classed("zoomed", false);

      g.transition()
        .duration(1000)
        .attr(
          "transform",
          /*`${flipTransform} translate(0,0) scale(1)`*/ ` translate(0,0) scale(1)`
        );
      currentZoomState = null;
      isSelected = false;
      zoomGraph = false;
    }
  }

  // Add reset on double click
  //svg.on("dblclick", resetZoom);

  scenarioSelect.on("change", (event) => {
    if (event.target.value === "Overall Difference") {
      diffLegend = true;
    } else {
      diffLegend = false;
    }
    update();
    if (currentZoomState) {
      const model = modelSelect.node().value;
      currentStateData = data.filter(
        (d) =>
          d.scenario === event.target.value &&
          d.year !== -1 &&
          d.model === model &&
          d.state === currentZoomState
      );
      //const usSeries = usSeriesByModel[event.target.value + model];
      if (d3.selectAll(".state-visualization").nodes().length !== 0) {
        createStateVisualizations(currentStateData, currentZoomState);
      }
      createSummaryStats(currentStateData);
    }
  });

  modelSelect.on("change", (event) => {
    update();
    if (currentZoomState) {
      const scenario = scenarioSelect.node().value;
      currentStateData = data.filter(
        (d) =>
          d.scenario === scenario &&
          d.year !== -1 &&
          d.model === event.target.value &&
          d.state === currentZoomState
      );
      //const usSeries = usSeriesByModel[scenario + event.target.value];
      if (d3.selectAll(".state-visualization").nodes().length !== 0) {
        createStateVisualizations(currentStateData, currentZoomState);
      }
      createSummaryStats(currentStateData);
    }
  });

  d3.select("#yearSlider").on("input", function () {
    const year = +this.value;
    //d3.select("#yearLabel").text(year);
    update();

    /*
    // Call global updater if subplot exists
    if (typeof updateYearLineGlobal === "function") {
      updateYearLineGlobal(year);
    }

    // Always update subplot if visible
    const updateYearLine = svg_state.property("updateYearLine");
    if (updateYearLine) updateYearLine(year);*/
  });

  update();

  function hideLegend() {
    d3.select("#legend")
      .style("opacity", 0)
      .style("visibility", "hidden")
      .style("display", "none");
  }

  function hideStats() {
    d3.select("#stats").style("opacity", 0).style("display", "none");
  }

  function showStats() {
    d3.select("#stats").style("opacity", 1).style("display", "block");
  }

  function hideButtons() {
    d3.selectAll(".state-visualization").remove();
    d3.select("#graphButtons").style("opacity", 0).style("display", "none");
  }

  function showButtons() {
    d3.select("#graphButtons").style("opacity", 1).style("display", "block");
  }

  function onSlideChange(slide) {
    const legend = d3.select("#legend");
    if (slide === 0) {
      //root.style.setProperty("--bg-color", "rgb(238, 238, 238)");
      hideLegend();
    } else {
      if (
        !isSelected &&
        d3.select("#stats").style("display") === "none" &&
        d3.select("#graphButtons").style("display") === "none"
      ) {
        legend
          .style("opacity", 1)
          .style("display", "block")
          .style("visibility", "visible");
      }
      switch (slide) {
        case 1:
          storyScenario = "SSP245";
          diffLegend = false;
          //root.style.setProperty("--bg-color", "#a3cefc");
          break;
        case 2:
          storyScenario = "SSP585";
          diffLegend = false;
          break;
        case 3:
          storyScenario = "Overall Difference";
          diffLegend = true;
          break;
        case 4:
          hideStats();
          hideLegend();
          break;
        case 5:
          createSummaryStats(northAvg);
          hideButtons();
          showStats();
          hideLegend();
          break;
        case 6:
          currentStateData = northAvg;
          currentZoomState = "Northern States";
          createStateVisualizations(northAvg, "Northern States", false);
          showButtons();
          hideStats();
          hideLegend();
          break;
        case 7:
          createSummaryStats(southData);
          hideButtons();
          showStats();
          hideLegend();
          break;
        case 8:
          currentStateData = southAvg;
          currentZoomState = "Southern States";
          createStateVisualizations(southAvg, "Southern States", false);
          showButtons();
          hideStats();
          hideLegend();
          break;
        case 9:
          createSummaryStats(northeastData);
          hideButtons();
          showStats();
          hideLegend();
          break;
        case 10:
          currentStateData = northeastAvg;
          currentZoomState = "Northeastern States";
          createStateVisualizations(northeastAvg, "Northeastern States", false);
          showButtons();
          hideStats();
          hideLegend();
          break;
        case 11:
          resetZoom();
          hideButtons();
          hideLegend();
          hideStats();
          break;
        case 12:
          resetZoom();
          currentStateData = storyData.filter((s) => s.state === "New Mexico");
          createSummaryStats(currentStateData);
          if (currentZoomState !== "New Mexico") {
            zoomInState(
              mainlandStates.find((s) => s.properties.name === "New Mexico"),
              d3.selectAll("#NewMexico").node()
            );
          }
          hideButtons();
          hideLegend();
          showStats();
          break;
        case 13:
          resetZoom();
          currentStateData = storyData.filter(
            (s) => s.state === "South Carolina"
          );
          createSummaryStats(currentStateData);
          if (currentZoomState !== "South Carolina") {
            zoomInState(
              mainlandStates.find(
                (s) => s.properties.name === "South Carolina"
              ),
              d3.selectAll("#SouthCarolina").node()
            );
          }
          hideButtons();
          hideLegend();
          showStats();
          break;
        case 14:
          resetZoom();
          currentStateData = storyData.filter((s) => s.state === "Florida");
          createSummaryStats(currentStateData);
          if (currentZoomState !== "Florida") {
            zoomInState(
              mainlandStates.find((s) => s.properties.name === "Florida"),
              d3.selectAll("#Florida").node()
            );
          }
          hideButtons();
          hideLegend();
          showStats();
          break;
        case 15:
          resetZoom();
          currentStateData = storyData.filter((s) => s.state === "Georgia");
          createSummaryStats(currentStateData);
          if (currentZoomState !== "Georgia") {
            zoomInState(
              mainlandStates.find((s) => s.properties.name === "Georgia"),
              d3.selectAll("#Georgia").node()
            );
          }
          hideButtons();
          hideLegend();
          showStats();
          break;
        case 16:
          resetZoom();
          currentStateData = storyData.filter(
            (s) => s.state === "Rhode Island"
          );
          createSummaryStats(currentStateData);
          if (currentZoomState !== "Rhode Island") {
            zoomInState(
              mainlandStates.find((s) => s.properties.name === "Rhode Island"),
              d3.selectAll("#RhodeIsland").node()
            );
          }
          hideButtons();
          hideLegend();
          showStats();
          break;
        case 17:
          resetZoom();
          currentStateData = storyData.filter((s) => s.state === "Delaware");
          createSummaryStats(currentStateData);
          if (currentZoomState !== "Delaware") {
            zoomInState(
              mainlandStates.find((s) => s.properties.name === "Delaware"),
              d3.selectAll("#Delaware").node()
            );
          }
          hideButtons();
          hideLegend();
          showStats();
          break;
        case 18:
          resetZoom();
          currentStateData = storyData.filter((s) => s.state === "Tennessee");
          createSummaryStats(currentStateData);
          if (currentZoomState !== "Tennessee") {
            zoomInState(
              mainlandStates.find((s) => s.properties.name === "Tennessee"),
              d3.selectAll("#Tennessee").node()
            );
          }
          hideButtons();
          hideLegend();
          showStats();
          d3.selectAll(".state-visualization, .close-btn").remove();
          d3.select("#graphButtons")
            .style("opacity", 0)
            .style("display", "none");
          break;
        case 19:
          resetZoom();
          hideButtons();
          hideLegend();
          d3.selectAll(".state-visualization, .close-btn").remove();
          d3.select("#graphButtons")
            .style("opacity", 0)
            .style("display", "none");
          break;
        default:
          diffLegend = false;
          break;
      }
    }
  }

  function onStepEnter(response) {
    const id = response.element.id;
    if (id === "last-text") {
      resetZoom();
      hideStats();
      enableUser = true;
    } else {
      enableUser = false;
    }
    //console.log(currentSlide);
    currentSlide = response.index;
    onSlideChange(currentSlide);
    update();
  }

  const scroller = scrollama();
  scroller
    .setup({
      container: "#main-container",
      step: "#main-container .textContainer",
    })
    .onStepEnter(onStepEnter);

  window.addEventListener("scroll", () => {
    const intro = document.getElementById("introContainer");
    const title = document.getElementById("mainTitle");

    const scrollY = window.scrollY;
    const trigger = 50; // begin fade after slight scroll

    if (scrollY > trigger) {
      intro.classList.add("fadeOut");
      title.classList.add("shrink");
    } else {
      intro.classList.remove("fadeOut");
      title.classList.remove("shrink");
    }
  });
});

function selectState() {
  /*d3.select("#chart")
    .selectAll("path")
    .nodes()
    .forEach((s) => {
      if (s != selectedState[0]) {
        if (selectedState[0].classList.contains("selected")) {
          d3.select(s).style("opacity", "0").style("visibility", "hidden");
        } else {
          d3.select(s).style("opacity", "1").style("visibility", "visible");
        }
      }
    });*/
  d3.select("#legend")
    .style("opacity", isSelected ? 0 : 1)
    .style("display", isSelected ? "none" : "block");
  d3.select("#stats")
    .style("opacity", isSelected ? 1 : 0)
    .style("display", isSelected ? "block" : "none");
  //svg_state.style("display", legendVisible ? "none" : "block");
}

function hoverOver(target) {
  d3.select(target).style("fill-opacity", 1).style("stroke-width", 1.5);
}

function hoverOut(target) {
  d3.select(target).style("fill-opacity", 0.7).style("stroke-width", 0.5);
}

function makeLegend(colorScale) {
  d3.select("#legend").selectAll("*").remove();
  const domain = colorScale.domain();
  const range = colorScale.range();

  const boxH = 22;
  const boxW = 50;
  const labelOffset = 35;
  const horizontalSpacing = 0; // Space between legend items

  // Calculate total width needed for horizontal legend
  const totalWidth = range.length * (boxW + horizontalSpacing) + 100;

  const svgLegend = d3
    .select("#legend")
    .attr("width", totalWidth)
    .attr("height", 50) // Fixed height for horizontal legend
    //.style("transition", "200ms")
    .style("overflow", "visible");

  const g = svgLegend.append("g").attr("transform", "translate(30,20)");
  let legendHover = [];

  range.forEach((color, i) => {
    g.append("rect")
      .attr("x", i * (boxW + horizontalSpacing)) // Position horizontally
      .attr("y", 0)
      .attr("width", boxW)
      .attr("height", boxH)
      .attr("fill", color)
      .style("fill-opacity", 0.7)
      .attr("stroke", "black")
      .style("stroke-width", 0.5)
      .attr("class", "states")
      .on("mouseenter", (event) => {
        hoverOver(event.currentTarget);
        d3.select("#chart")
          .selectAll("path")
          .nodes()
          .forEach((d) => {
            if (d.getAttribute("fill") === color) {
              hoverOver(d);
              legendHover.push(d);
            }
          });
      })
      .on("mouseleave", (event) => {
        hoverOut(event.currentTarget);
        legendHover.forEach((c) => hoverOut(c));
        legendHover = [];
      });

    let label;
    if (i === 0) label = "< " + domain[0];
    else if (i === range.length - 1) label = "> " + domain[domain.length - 1];
    else label = domain[i - 1] + " to " + domain[i];

    g.append("text")
      .attr("x", i * (boxW + horizontalSpacing) + boxW / 2) // Center text below box
      .attr("y", boxH + 15) // Position text below the box
      .style("font-size", "10px") // Slightly smaller for horizontal layout
      .style("text-anchor", "middle") // Center the text
      .style("fill", "white")
      .text(label);
  });

  svgLegend
    .append("text")
    .attr("x", (totalWidth - 50) / 2)
    .attr("y", 12)
    .style("font-weight", "bold")
    .style("font-size", "11px")
    .style("text-anchor", "middle")
    .style("fill", "white")
    .text("Temperature (°C)");
}

function createGraphButtons() {
  d3.selectAll(".graph-buttons").remove();
  const svg = d3.select("#graphButtons");

  const dl = svg.append("dl").attr("class", "graph-buttons");

  dl.append("dt").text("Brush Tool");
  dl.append("dd").html(`<button id="toggleBrush">On</button>`);

  dl.append("dt").text("Reset Brush");
  dl.append("dd").html(`<button id="resetBrush">Reset</button>`);
}

createGraphButtons();

const brushButton = document.getElementById("toggleBrush");
brushButton.addEventListener("click", () => {
  isBrush = !isBrush;
  brushButton.textContent = isBrush ? "On" : "Off";
  const brush = d3.selectAll(".brush");
  brush.style("display", isBrush ? "block" : "none");
  //brush.style('display',isBrush ? "block" : "none");
});

document.getElementById("resetBrush").addEventListener("click", () => {
  resetBrush();
});

function createSummaryStats(stateData) {
  d3.selectAll(".state-summary").remove();
  const svg = d3.select("#stats");

  const dl = svg.append("dl").attr("class", "state-summary");

  const means = {
    tas: d3.mean(stateData, (d) => d.tas_degree).toFixed(2),
    pr: d3.mean(stateData, (d) => d.pr).toFixed(2),
    prsn: d3.mean(stateData, (d) => d.prsn).toFixed(2),
    mrsos: d3.mean(stateData, (d) => d.mrsos).toFixed(2),
  };

  dl.append("dt").text("Mean Temperature");
  dl.append("dd").html(`${means["tas"]}<em style="font-size: 0.5em;">°C</em>`);

  dl.append("dt").text("Mean Precipitation");
  dl.append("dd").html(`${means["pr"]}<em style="font-size: 0.5em;">mm</em>`);

  dl.append("dt").text("Mean Snowfall");
  dl.append("dd").html(`${means["prsn"]}<em style="font-size: 0.5em;">mm</em>`);

  dl.append("dt").text("Mean Soil Moisture");
  dl.append("dd").html(
    `${means["mrsos"]}<em style="font-size: 0.5em;">mm</em>`
  );
}

function createStateVisualizations(stateData, stateName, button = true) {
  // Clear previous
  zoomGraph = false;
  d3.selectAll(".state-visualization, .close-btn").remove();

  const svg = d3.select("#chart");
  const svgWidth = +svg.attr("width") || WIDTH; // fallback width
  const svgHeight = +svg.attr("height") || HEIGHT; // fallback height

  const vizContainer = svg.append("g").attr("class", "state-visualization");

  // Explicit positions for each quadrant
  const positions = [
    { x: 0, y: 0 }, // top-left
    { x: svgWidth / 2, y: 0 }, // top-right
    { x: 0, y: svgHeight / 2 }, // bottom-left
    { x: svgWidth / 2, y: svgHeight / 2 }, // bottom-right
  ];

  const variables = [
    { key: "tas_degree", label: "Temperature" },
    { key: "pr", label: "Precipitation" },
    { key: "prsn", label: "Snowfall" },
    { key: "mrsos", label: "Soil Moisture" },
  ];

  const graphWidth = svgWidth / 2;
  const graphHeight = svgHeight / 2;
  const margin = { top: 40, right: 20, bottom: 45, left: 55 };

  // Create x scale
  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(stateData, (d) => d.year))
    .range([margin.left, graphWidth - margin.right]);
  //.nice();

  // Create each graph
  variables.forEach((variable, i) => {
    const pos = positions[i];
    createSingleGraph(
      vizContainer,
      stateData,
      pos.x,
      pos.y,
      graphWidth,
      graphHeight,
      xScale,
      variable.key,
      variable.label,
      stateName,
      margin,
      i === 0
    );
  });

  if (button) addCloseButton(svg);
}

// Gridlines function
function addGridlines(graphGroup, yScale, width, margin) {
  // Remove existing gridlines if any
  graphGroup.selectAll(".grid").remove();

  // Calculate the actual plotting area dimensions
  const plotWidth = width - margin.left;

  // Horizontal gridlines (for Y-axis)
  graphGroup
    .append("g")
    .attr("class", "grid grid-horizontal")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(
      d3
        .axisLeft(yScale)
        .tickSize(-plotWidth) // Negative extends to the right
        .tickFormat("") // Remove labels
    );
}

function createSingleGraph(
  container,
  data,
  x,
  y,
  width,
  height,
  xScale,
  dataKey,
  label,
  stateName,
  margin,
  addBrush = false
) {
  const units = {
    Temperature: "(°C)",
    Precipitation: "(mm)",
    Snowfall: "(mm)",
    "Soil Moisture": "(mm)",
  };

  const thresholds = {
    Temperature: 1.5,
    Precipitation: 24,
    Snowfall: -8,
    "Soil Moisture": -1.5,
  };

  let className = zoomGraph ? "zoom-graph" : "line-graph";
  const graphGroup = container
    .append("g")
    .attr("class", `${className} ${dataKey}`)
    .attr("transform", `translate(${x}, ${y})`)
    .on("click", (event) => {
      const allGraphs = d3.selectAll(".line-graph").nodes();
      if (!zoomGraph) {
        allGraphs.forEach((g) => {
          d3.select(g).style("visibility", "hidden");
        });
        const newScale = d3
          .scaleLinear()
          .domain(d3.extent(data, (d) => d.year))
          .range([margin.left, WIDTH - margin.right]);
        //;
        zoomGraph = true;
        createSingleGraph(
          container,
          data,
          0,
          0,
          WIDTH,
          HEIGHT,
          newScale,
          dataKey,
          label,
          stateName,
          margin
        );
        d3.selectAll(".threshold-label")
          .nodes()
          .forEach((t) => {
            d3.select(t).style("opacity", 1);
          });
      } else {
        d3.select(".zoom-graph").remove();
        allGraphs.forEach((g) => {
          d3.select(g).style("visibility", "visible");
        });
        zoomGraph = false;
        d3.selectAll(".threshold-label")
          .nodes()
          .forEach((t) => {
            d3.select(t).style("opacity", 0);
          });
      }
    });

  // Y scale for this graph
  const yScale = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d[dataKey]))
    .range([height - margin.bottom, margin.top]);
  //.nice();

  // Background
  graphGroup
    .append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "rgba(25, 25, 25, 0.9)")
    .attr("stroke", "#ddd");

  // Add gridlines to TAS graph
  addGridlines(graphGroup, yScale, width, margin);

  // Line
  const line = d3
    .line()
    .x((d) => xScale(d.year))
    .y((d) => yScale(d[dataKey]))
    .curve(d3.curveMonotoneX);

  function isInViewRange(thresholdValue) {
    const yPos = yScale(thresholdValue);
    // Check if it's within the visible SVG area
    return yPos >= margin.top && yPos <= height - margin.bottom;
  }

  // Add the threshold line
  if (isInViewRange(thresholds[label])) {
    const thresholdLine = graphGroup
      .append("line")
      .attr("id", "threshold-line")
      .attr("x1", margin.left) // Starting x (left margin)
      .attr("x2", width - margin.right) // Ending x (right margin)
      .attr("y1", yScale(thresholds[label]))
      .attr("y2", yScale(thresholds[label]))
      .attr("stroke", "white") // Red color for danger
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5") // Creates dotted line
      .attr("opacity", 0.7);

    // Add label for the threshold
    const thresholdLabel = graphGroup
      .append("text")
      .attr("class", "threshold-label")
      .attr("x", width - 100) // Position on right side
      .attr("y", yScale(thresholds[label]) - 10) // Above the line
      .attr("text-anchor", "end")
      .attr("fill", "white")
      .attr("font-size", "1rem")
      .attr("font-weight", "bold")
      .text(`Threshold: +${thresholds[label]}${units[label]}`);
  }

  graphGroup
    .append("path")
    .datum(data)
    .attr("d", line)
    .attr("fill", "none")
    .attr("stroke", "rgb(245, 101, 87)")
    .attr("stroke-width", 2);

  // Axes
  graphGroup
    .append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .attr("color", "white")
    .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

  graphGroup
    .append("g")
    .attr("transform", `translate(${margin.left}, 0)`)
    .attr("color", "white")
    .call(d3.axisLeft(yScale));

  // Labels
  graphGroup
    .append("text")
    .attr("x", width / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .style("fill", "white")
    .text(`Annual ${label} of ${stateName}`);

  graphGroup
    .append("text")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("fill", "white")
    .text("Years");

  graphGroup
    .append("text")
    .attr("transform", "rotate(-90)") // Rotate for vertical text
    .attr("y", 0 + 5) // Position left of the y-axis
    .attr("x", 0 - height / 2) // Center vertically
    .attr("dy", "1em") // Adjust vertical alignment
    .style("text-anchor", "middle")
    .style("font-size", "12px")
    .style("fill", "white")
    .text(`${label} ${units[label]}`);

  if (isInViewRange(thresholds[label])) {
    // Add label for the threshold
    const thresholdLabel = graphGroup
      .append("text")
      .attr("class", "threshold-label")
      .attr("x", width - 100) // Position on right side
      .attr("y", yScale(thresholds[label]) - 10) // Above the line
      .attr("text-anchor", "end")
      .attr("fill", "white")
      .attr("font-size", "1rem")
      .attr("font-weight", "bold")
      .text(`Threshold: +${thresholds[label]}${units[label]}`);
  }

  // Add brush to the first graph only
  if (addBrush && !zoomGraph) {
    addBrushToGraph(graphGroup, width, height, margin, xScale);
  }
}

//////////////////////////////
//////////////////////////////
//////////////////////////////
//////////////////////////////
function addBrushToGraph(graphGroup, width, height, margin, xScale) {
  // Create brush group
  const brushGroup = graphGroup.append("g").attr("class", "brush");

  // Create the brush
  const brush = d3
    .brushX()
    .extent([
      [margin.left, margin.top],
      [width - margin.right, height - margin.bottom],
    ])
    .on("start", brushStarted)
    .on("brush", brushed)
    .on("end", brushEnded);

  // Add brush to the group
  brushGroup.call(brush);

  // Style the selection area
  /*brushGroup
    .selectAll(".selection")
    .attr("fill", "#2c5aa0")
    .attr("fill-opacity", 0.2)
    .attr("stroke", "#2c5aa0")
    .attr("stroke-width", 1);*/

  // Add brush label
  /*graphGroup
    .append("text")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("fill", "#666")
    .text("Drag to select year range");*/

  //graphGroup.selectAll("path, .overlay ~ *").raise();
}

function brushed(event) {
  // This function handles the brushing motion
  // We'll do the actual filtering in brushEnded
}

// When brush starts
function brushStarted() {
  d3.select(".line-graph").attr("data-brushing", "true");
}

let brushScale = null;

function brushEnded(event) {
  if (!isBrush) return;
  d3.select(".line-graph").attr("data-brushing", "false");
  if (!event.selection) {
    // If no selection, reset to show all data
    brushExtent = null;
    resetBrush();
    return;
  }

  // Get the selected year range
  const [x0, x1] = event.selection;
  //console.log(event.selection);
  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(currentStateData, (d) => d.year))
    .range([55, WIDTH / 2 - 20]); // Adjust based on your actual margin and width

  const selectedStartYear = Math.round(
    brushScale ? brushScale.invert(x0) : xScale.invert(x0)
  );
  const selectedEndYear = Math.round(
    brushScale ? brushScale.invert(x1) : xScale.invert(x1)
  );

  brushExtent = [selectedStartYear, selectedEndYear];

  // Filter the data and update all graphs
  filterDataByYearRange(selectedStartYear, selectedEndYear);
  brushScale = d3
    .scaleLinear()
    .domain(brushExtent)
    .range([50, WIDTH / 2 - 20]);
}

function filterDataByYearRange(startYear, endYear) {
  const filteredData = currentStateData.filter(
    (d) => d.year >= startYear && d.year <= endYear
  );

  // Update all graphs with filtered data
  if (currentSlide >= 4 && currentSlide <= 11) {
    createStateVisualizations(filteredData, currentZoomState, false);
  } else {
    createStateVisualizations(filteredData, currentZoomState);
  }
}

function resetBrush() {
  brushExtent = null;
  brushScale = null;
  // Restore all graphs with original data
  if (currentSlide >= 4 && currentSlide <= 11) {
    createStateVisualizations(currentStateData, currentZoomState, false);
  } else {
    createStateVisualizations(currentStateData, currentZoomState);
  }
}

function addCloseButton(svg) {
  const closeBtn = svg
    .append("g")
    .attr("class", "close-btn")
    .attr("transform", `translate(${WIDTH - 20}, 20)`)
    .style("cursor", "pointer")
    .on("click", function () {
      d3.selectAll(".state-visualization").remove();
      d3.selectAll(".close-btn").remove();
      d3.selectAll(".state").classed("selected", false);
      zoomGraph = false;
      d3.select("#graphButtons").style("opacity", 0).style("display", "none");
      d3.select("#stats").style("opacity", 1).style("display", "block");
      isBrush = true;
      brushButton.textContent = "On";
      brushScale = null;
    });

  closeBtn
    .append("circle")
    .attr("r", 12)
    .attr("fill", "rgb(245, 101, 87)")
    .attr("stroke", "#cc0000")
    .attr("stroke-width", 1);

  closeBtn
    .append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.3em")
    .attr("fill", "white")
    .style("font-weight", "bold")
    .text("×");
}

const showFilter = document.getElementById("showFilter");
const filterToggles = document.getElementById("filterToggles");
showFilter.addEventListener("click", () => {
  filterToggles.style.display =
    filterToggles.style.display === "none" ? "block" : "none";
});

gsap.registerPlugin(ScrollTrigger);

// Get elements
const INTRO_HEIGHT = 1000;
const svg_intro = d3
  .select("#introGraph")
  .attr("viewBox", `0 0 ${WIDTH} ${INTRO_HEIGHT}`)
  .style("overflow", "hidden");
const arrow = document.querySelector("#arrow-head");

// Add text element to your SVG
const textLabel = svg_intro
  .append("text")
  .attr("id", "progress-label")
  .attr("font-weight", "bold")
  .attr("fill", "rgb(245, 101, 87)")
  .attr("text-anchor", "right")
  .attr("opacity", 0)
  .text("Greenhouse Gases");

// Create an exponential curve
function createExponentialPath() {
  const margin = 50;

  // Use a single cubic bezier with carefully chosen control points
  // This creates one continuous smooth curve

  // Start point (bottom-left)
  const startX = margin;
  const startY = INTRO_HEIGHT - margin;

  // End point (top-right)
  const endX = WIDTH - margin;
  const endY = margin;

  // Control points for convex upward curve
  // Control point 1: slightly right of start, keeps curve low initially
  const cp1x = startX + (endX - startX) * 0.8;
  const cp1y = startY; // Keep it at bottom level

  // Control point 2: near the end, pulls curve up sharply
  const cp2x = startX + (endX - startX);
  const cp2y = endY; // Pull to top level

  // SINGLE cubic bezier curve (smooth)
  return `M ${startX} ${startY} 
            C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
}

// Set the exponential path
const path = document.querySelector("#trend-path");
path.setAttribute("d", createExponentialPath());

// Get total length of the path
const length = path.getTotalLength();

// Prepare the line to be invisible initially
path.style.strokeDasharray = length;
path.style.strokeDashoffset = length;

// Hide arrow initially
arrow.style.opacity = 0;

// Animation that draws the path
gsap.to(path, {
  strokeDashoffset: 0,
  ease: "none",
  scrollTrigger: {
    trigger: "#introText",
    start: "top center",
    end: "bottom bottom",
    scrub: true,
    markers: false, // Set to true for debugging
  },
  onStart: function () {
    // Show arrow when animation starts
    gsap.to(arrow, { opacity: 1, duration: 0.5 });
  },
  onUpdate: function (self) {
    // Compute current position along path
    const progress = 1 - path.style.strokeDashoffset / length;
    const currentLength = progress * length;
    const point = path.getPointAtLength(currentLength);
    const angle = getTangentAngle(path, currentLength);

    // Position arrowhead directly ON the line
    // Using transformOrigin at the arrow tip (0,0 point)
    gsap.set(arrow, {
      attr: {
        transform: `translate(${point.x}, ${point.y}) rotate(${angle})`,
      },
    });

    // Position text to the right of the arrow with an offset
    const textOffset = 700; // Distance from arrow
    const textAngle = angle; // Match arrow's rotation

    // Calculate position for text (perpendicular offset from path)
    const textPoint = path.getPointAtLength(currentLength + 5); // Slightly ahead
    gsap.set(textLabel.node(), {
      attr: {
        transform: `translate(${textPoint.x - textOffset * progress}, ${
          textPoint.y + 100
        })`,
        opacity: progress,
      },
    });
    textLabel.style("font-size", `${progress * 5}em`);
  },
});

// Helper: gets tangent angle for arrow direction
function getTangentAngle(path, len) {
  // Get point slightly ahead for direction calculation
  const epsilon = 1; // Small delta
  const p1 = path.getPointAtLength(Math.max(0, len - epsilon));
  const p2 = path.getPointAtLength(Math.min(length, len + epsilon));

  // Calculate angle in radians, convert to degrees
  const angleRad = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  return angleRad * (180 / Math.PI);
}
