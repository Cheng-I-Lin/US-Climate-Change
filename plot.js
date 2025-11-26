import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import scrollama from "https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm";

// config
const WIDTH = 1000,
  HEIGHT = 600;

const svg = d3
  .select("#chart")
  .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
  .style("overflow", "hidden");

/*const svg_state = d3
  .select("#state-chart")
  .style("overflow", "visible")
  .style("display", "none");*/

const tooltip = d3.select("#tooltip");
//const stateName = document.querySelector("#state-name");

const geoURL =
  "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";
const dataURL = "combined_data.csv";

//var plotName;
var isSelected = false;
//var legendVisible = true;
let updateYearLineGlobal = null;
var enableUser = false;
//const slideNum = d3.select('#mainText').selectAll('div').nodes().length;
//const slides = Array.from({ length: slideNum }, (_, i) => i + 1);
var currentSlide = 0;
var storyScenario = "SSP245";
var diffLegend = false;
const storyState = ["Michigan", "Rhode Island", "New York"];

// Store original transform state
let currentZoomState = null;
let currentStateData=null;
let zoomGraph = false;

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

  const usSeriesByModel = {};
  for (const s of scenarios) {
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
  }

  const years = Array.from(new Set(data.map((d) => d.year))).sort(
    (a, b) => a - b
  );
  d3.select("#yearSlider")
    .attr("min", years[1] - 1) //Makes -1 all year
    .attr("max", years[years.length - 1])
    .attr("value", years[0]);
  d3.select("#yearLabel").text(years[0]);

  const mainlandStates = geo.features.filter((feature) => {
    const name = feature.properties.name || feature.properties.NAME;
    return name !== "Alaska" && name !== "Puerto Rico" && name !== "Hawaii";
  });
  const mainlandGeo = {
    type: "FeatureCollection",
    features: mainlandStates,
  };
  const projection = d3.geoIdentity().fitSize([WIDTH, HEIGHT], mainlandGeo);
  const path = d3.geoPath().projection(projection);

  //makeLegend(color);

  const g = svg
    .append("g")
    .attr("transform", `scale(1, -1) translate(0, -${HEIGHT})`);

  let legendHover;
  const states = g
    .selectAll("path")
    .data(mainlandStates)
    .join("path")
    .attr("d", path)
    .attr("stroke", "#333")
    .attr("stroke-width", 0.5)
    .attr("class", "states")
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

  function update() {
    const model = modelSelect.node().value;
    const scenario = scenarioSelect.node().value;
    const year = +d3.select("#yearSlider").node().value;
    let yearValue = year;

    if (!diffLegend) {
      makeLegend(color);
    } else {
      makeLegend(diffColor);
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
    const filteredLookup = Object.fromEntries(
      Object.entries(lookup).filter(([key]) => storyState.includes(key))
    );
    states
      .style("fill-opacity", 0.7)
      .attr("fill", (d) => {
        if (currentSlide === 0) {
          return "#ccc";
        }
        const name = d.properties.name;
        if (currentSlide === 3 || scenario === "Overall Difference") {
          return lookup[name] ? diffColor(lookup[name]) : "#ccc";
        } else {
          if ([4, 5].includes(currentSlide)) {
            //Colors only the selected states
            return Object.keys(filteredLookup).includes(name)
              ? diffColor(lookup[name])
              : "#ccc";
          } else {
            return lookup[name] ? color(lookup[name]) : "#ccc";
          }
        }
      })
      .on("mouseover", (event, d) => {
        const name = d.properties.name;
        const val = lookup[name];
        if (currentSlide != 0 && !isSelected) {
          tooltip
            .style("display", "block")
            .style("left", event.offsetX + 5 + "px")
            .style("top", event.offsetY + 5 + "px")
            .html(
              `<b>${name}</b><br>${val ? val.toFixed(2) + " °C" : "No Data"}`
            );
        }
      })
      .on("mouseout", () => tooltip.style("display", "none"))
      .on("click", (event, d) => {
        const usSeries = usSeriesByModel[scenario + model];
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
            /*
            if (selectedState.length == 0)
              selectedState.push(event.currentTarget);
            
            if (isZoomed) {
              if (event.currentTarget.classList.contains("selected")) {
                event.currentTarget.classList.remove("selected");
                isSelected = false;
                selectState();
                selectedState.pop();
                .innerHTML =
                  "Click a state to see temperature data aggregated by the chosen state";
              }
            } else {
              if (!event.currentTarget.classList.contains("selected")) {
                const name = d.properties.name;
                plotName = name;
                const filtered = data.filter(
                  (d) =>
                    d.scenario === scenario &&
                    d.model === model &&
                    d.state === name
                );
                event.currentTarget.classList.add("selected");
                isSelected = true;
                selectState();
                //moveStateToLeft(selectedState[0]);
                zoomInState(d, event.currentTarget);
                subplot(filtered, usSeries);
                //stateName.innerHTML = "Click " + plotName + " to deselect";
              }
            }*/
          }
        }
      });
    d3.select("#stats").on("click", () => {
      createStateVisualizations(currentStateData, currentZoomState);
    });
  }

  const flipTransform = `scale(1, -1) translate(0, -${HEIGHT})`;

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
      g.transition()
        .duration(1000)
        .attr(
          "transform",
          `${flipTransform} translate(${translate[0]},${translate[1]}) scale(${scale})`
        );
      currentZoomState = stateName;
      isSelected = true;
    }
  }

  // Reset zoom function
  function resetZoom() {
    if (isSelected) {
      g.selectAll(".states").classed("faded", false).classed("zoomed", false);

      g.transition()
        .duration(1000)
        .attr("transform", `${flipTransform} translate(0,0) scale(1)`);
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
      const filtered = data.filter(
        (d) =>
          d.scenario === event.target.value &&
          d.year !== -1 &&
          d.model === model &&
          d.state === currentZoomState
      );
      const usSeries = usSeriesByModel[event.target.value + model];
      createStateVisualizations(filtered, currentZoomState);
    }
  });

  modelSelect.on("change", (event) => {
    update();
    if (currentZoomState) {
      const scenario = scenarioSelect.node().value;
      const filtered = data.filter(
        (d) =>
          d.scenario === scenario &&
          d.year !== -1 &&
          d.model === event.target.value &&
          d.state === currentZoomState
      );
      const usSeries = usSeriesByModel[scenario + event.target.value];
      createStateVisualizations(filtered, currentZoomState);
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

  function onSlideChange(slide) {
    const legend = d3.select("#legend");
    if (slide === 0) {
      //root.style.setProperty("--bg-color", "rgb(238, 238, 238)");
      legend.style("opacity", 0).style("visibility", "hidden");
    } else {
      legend
        .style("opacity", 1)
        .style("display", "block")
        .style("visibility", "visible");
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
          legend.style("opacity", 0).style("visibility", "hidden");
          break;
        case 5:
          legend.style("opacity", 0).style("visibility", "hidden");
          d3.selectAll(
            ".state-visualization, .close-btn, .state-summary"
          ).remove();
          resetZoom();
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
      enableUser = true;
    } else {
      enableUser = false;
    }
    currentSlide = response.index;
    onSlideChange(currentSlide);
    update();
    //console.log(currentSlide);
  }

  const scroller = scrollama();
  scroller
    .setup({
      container: "#main-container",
      step: "#main-container .textContainer",
    })
    .onStepEnter(onStepEnter);
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
      .attr("stroke", "#333")
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
      .text(label);
  });

  svgLegend
    .append("text")
    .attr("x", (totalWidth - 50) / 2)
    .attr("y", 12)
    .style("font-weight", "bold")
    .style("font-size", "11px")
    .style("text-anchor", "middle")
    .text("Temperature (°C)");
}

/*function subplot(stateData, usSeries) {
  svg_state.selectAll("*").remove();

  const margin = { top: 70, right: 40, bottom: 60, left: 70 },
    innerWidth = width - margin.left - margin.right,
    innerHeight = height - margin.top - margin.bottom;

  const g = svg_state
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleLinear()
    .domain(
      d3.extent(
        d3.merge([stateData.map((d) => d.year), usSeries.map((d) => d.year)])
      )
    )
    .range([0, innerWidth])
    .nice();

  const allTemps = [
    ...stateData.map((d) => d.tas_degree),
    ...usSeries.map((d) => d.mean),
  ];
  const y = d3
    .scaleLinear()
    .domain([d3.min(allTemps) - 0.3, d3.max(allTemps) + 0.3])
    .range([innerHeight, 0])
    .nice();

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")))
    .call((g) =>
      g
        .append("text")
        .attr("x", innerWidth / 2)
        .attr("y", 45)
        .attr("fill", "black")
        .attr("text-anchor", "middle")
        .attr("font-size", 14)
        .text("Year")
    );

  g.append("g")
    .call(d3.axisLeft(y))
    .call((g) =>
      g
        .append("text")
        .attr("x", -innerHeight / 2)
        .attr("y", -50)
        .attr("transform", "rotate(-90)")
        .attr("fill", "black")
        .attr("text-anchor", "middle")
        .attr("font-size", 14)
        .text("Temperature (°C)")
    );

  g.append("g")
    .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(""))
    .attr("stroke-opacity", 0.08);

  const stateLine = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => y(d.tas_degree))
    .curve(d3.curveMonotoneX);

  const usLine = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => y(d.mean))
    .curve(d3.curveMonotoneX);

  g.append("path")
    .datum(usSeries)
    .attr("fill", "none")
    .attr("stroke", "#444")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "6 4")
    .attr("d", usLine);

  g.append("path")
    .datum(stateData)
    .attr("fill", "none")
    .attr("stroke", "#007acc")
    .attr("stroke-width", 2.5)
    .attr("d", stateLine);

  // --- Year line (vertical dotted line) ---
  // --- Year line and label ---
  const yearLine = g
    .append("line")
    .attr("class", "year-line")
    .attr("stroke", "black")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "4 4")
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("opacity", 0.8);

  // const yearLabelText = g.append("text")
  // .attr("class", "year-label")
  // .attr("y", -10)
  // .attr("text-anchor", "middle")
  // .attr("font-size", 12)
  // .attr("fill", "#990000");

  function updateYearLine(year) {
    const xPos = x(year);
    const yPos = innerHeight * 0.25; // 25% down from top of plot area (relative positioning)

    yearLine.attr("x1", xPos).attr("x2", xPos);

    //     yearLabelText
    //       .attr("x", xPos + 20)  // slight horizontal offset so text doesn’t overlap the line
    //       .attr("y", yPos - 55)      // vertical placement stays relative to chart height
    //       .text(year);
    //   }
    d3.select(".legend-year").text("Year: " + year);
  }

  const currentYear = +d3.select("#yearSlider").node().value;
  updateYearLine(currentYear);
  updateYearLineGlobal = updateYearLine;

  svg_state.property("updateYearLine", updateYearLine);

  const trendState = linearTrend(stateData, "year", "tas_degree");
  const trendUS = linearTrend(usSeries, "year", "mean");
  const slopeStateDecade = trendState.slope * 10;
  const slopeUSDecade = trendUS.slope * 10;

  const compare =
    slopeStateDecade > slopeUSDecade
      ? "Rising faster than the U.S. average"
      : "Rising slower than the U.S. average";

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", -40)
    .attr("text-anchor", "middle")
    .attr("font-size", 16)
    .attr("font-weight", "bold")
    .text(
      "Average Annual Near Surface Temperature of " +
        plotName +
        " (2015 ~ 2100)"
    );

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", -18)
    .attr("text-anchor", "middle")
    .attr("font-size", 13)
    .attr("fill", "#555")
    .text(
      `${stateData[0].state} warming at ${slopeStateDecade.toFixed(
        2
      )}°C per decade under ${
        stateData[0].model
      } (2015–2100). ${compare} (${slopeUSDecade.toFixed(2)}°C).`
    );

  const legend = g.append("g").attr("transform", `translate(10, 10)`);

  legend
    .append("rect")
    .attr("x", -5)
    .attr("y", -5)
    .attr("width", 140)
    .attr("height", 70)
    .attr("fill", "white")
    .attr("stroke", "#ccc")
    .attr("opacity", 0.8);

  legend
    .append("line")
    .attr("x1", 0)
    .attr("x2", 24)
    .attr("y1", 8)
    .attr("y2", 8)
    .attr("stroke", "#007acc")
    .attr("stroke-width", 2.5);
  legend
    .append("text")
    .attr("x", 32)
    .attr("y", 12)
    .attr("font-size", 12)
    .text("State");

  legend
    .append("line")
    .attr("x1", 0)
    .attr("x2", 24)
    .attr("y1", 28)
    .attr("y2", 28)
    .attr("stroke", "#444")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "6 4");
  legend
    .append("text")
    .attr("x", 32)
    .attr("y", 32)
    .attr("font-size", 12)
    .text("U.S. mean");
  // year label (dynamic text)
  legend
    .append("line")
    .attr("x1", 0)
    .attr("x2", 24)
    .attr("y1", 48)
    .attr("y2", 48)
    .attr("stroke", "#a30000") // dark red, consistent with year line
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "5 5");

  legend
    .append("text")
    .attr("class", "legend-year")
    .attr("x", 32)
    .attr("y", 52)
    .attr("font-size", 12)
    .text("Year: " + d3.select("#yearSlider").node().value);

  function linearTrend(data, xKey, yKey) {
    const n = data.length;
    const sumX = d3.sum(data, (d) => d[xKey]);
    const sumY = d3.sum(data, (d) => d[yKey]);
    const sumXY = d3.sum(data, (d) => d[xKey] * d[yKey]);
    const sumXX = d3.sum(data, (d) => d[xKey] * d[xKey]);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
  }
}*/

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

  dl.append("dt").text("TAS Mean");
  dl.append("dd").text(means["tas"]);

  dl.append("dt").text("PR Mean");
  dl.append("dd").text(means["pr"]);

  dl.append("dt").text("PRSN Mean");
  dl.append("dd").text(means["prsn"]);

  dl.append("dt").text("MRSOS Mean");
  dl.append("dd").text(means["mrsos"]);
}

function createStateVisualizations(stateData, stateName) {
  // Clear previous
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
    { key: "tas_degree", label: "Temperature (°C)" },
    { key: "pr", label: "Precipitation" },
    { key: "prsn", label: "Snowfall" },
    { key: "mrsos", label: "Soil Moisture" },
  ];

  const graphWidth = svgWidth / 2;
  const graphHeight = svgHeight / 2;
  const margin = { top: 40, right: 20, bottom: 40, left: 50 };

  // Create x scale
  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(stateData, (d) => d.year))
    .range([margin.left, graphWidth - margin.right]);

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
      margin
    );
  });

  addCloseButton(svg);
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
  margin
) {
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
      } else {
        d3.select(".zoom-graph").remove();
        allGraphs.forEach((g) => {
          d3.select(g).style("visibility", "visible");
        });
        zoomGraph = false;
      }
    });

  // Y scale for this graph
  const yScale = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d[dataKey]))
    .range([height - margin.bottom, margin.top])
    .nice();

  // Background
  graphGroup
    .append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "rgba(255,255,255,0.9)")
    .attr("stroke", "#ddd");

  // Line
  const line = d3
    .line()
    .x((d) => xScale(d.year))
    .y((d) => yScale(d[dataKey]))
    .curve(d3.curveMonotoneX);

  graphGroup
    .append("path")
    .datum(data)
    .attr("d", line)
    .attr("fill", "none")
    .attr("stroke", "#2c5aa0")
    .attr("stroke-width", 2);

  // Axes
  graphGroup
    .append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

  graphGroup
    .append("g")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(yScale));

  // Labels
  graphGroup
    .append("text")
    .attr("x", width / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .text(`${label} - ${stateName}`);
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
    });

  closeBtn
    .append("circle")
    .attr("r", 12)
    .attr("fill", "#ff4444")
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
