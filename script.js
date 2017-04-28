$(function(){
let soChart;

// source: http://stackoverflow.com/questions/610406/javascript-equivalent-to-printf-string-format
if (!String.prototype.format) { // First, checks if it isn't implemented yet.
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) {
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

function Datestring(s){
    return {
        string: s,
        date: new Date(s),
        equals: (d) => d.string === s
    }
}

const START_DATE = Datestring('2017-01-01');
const END_DATE = Datestring('2017-03-13');


Vue.component('related-tag', {
    template: '<div>{{ tag }}</div'
});

window.app = new Vue({
    el: '#app',
    data: {
        title : "Stack Overflow Tag Visualization",
        relatedTags: [ ],
        currentTag: "",
    },
    // expose these to html
    methods: {
        getNewTag,
        chart: () => soChart
    }
});

// add a d3 graph to the body of the webpage.
// The graph should show tags vs time for any tag I choose.
// It should also show results for groups of tags.

const jumbotronDimensions = $('.jumbotron')[0].getBoundingClientRect();
const viewPortWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
const viewPortHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

const WIDTH = viewPortWidth / 3;
const HEIGHT = viewPortHeight / 3;
const MARGIN = {
    top: 100,
    right: 50,
    bottom: 60,
    left: (jumbotronDimensions.left) / 2
};

const chart = d3.select("div.svg-container")
.append("div")
.append("svg")
.attr("width", WIDTH + MARGIN.left + MARGIN.right)
.attr("height", HEIGHT + MARGIN.top + MARGIN.bottom);

// Add another graphic onto same svg. must be called after createChart()
function addLayer(){
    const layer =  chart.append("g")
        .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
    return layer;
}

class StackOverflowChart {

    constructor(){
        this.queries = [];
        this.color = -1;
        this.maxQueriesSingleDay = 0;
        this.yScale = null;
        this.start = START_DATE;  // positive inifinity
        this.end =  END_DATE;  // negative infinity
    }

    nextColor(){
        this.color = (this.color + 1) % 10;
        return d3.schemeCategory10[this.color];
    }

    addQuery(tag, data){
        // remove the graphs. Each time a graph is added, redraw the entire chart to adjust for scaling issues.
        const query = { tag, data, color: this.nextColor() };
        query.maxQueriesSingleDay = d3.max(data, d=>d[1]);
        this.queries.push(query);

        if(data.length > 0){
            this.maxQueriesSingleDay = Math.max(this.maxQueriesSingleDay, query.maxQueriesSingleDay);
        }

        this.addButton(query);
        this.repaint();
    }

    addButton(query){
        const div = $('<div/>', {
            class: 'list-group-item current-tag',
            text:  " " + query.tag,
            style: `border-color: ${query.color}; border-width: 4px`,
        }).prepend($('<span/>', {
            class: "glyphicon glyphicon-trash",
            style: `color: ${query.color}`
        }));
        div.data('query', query);
        div.click( (e) => this.removeQuery(div.data('query')));
        div.appendTo('#vis-tag-list');
        query.div = div;
    }

    removeQuery(query){

        query.div.remove();
        this.queries = this.queries.filter(q => q !== query);

        // reset max queries so that scale decreases when deleting a query
        this.maxQueriesSingleDay = d3.max(this.queries.map(q => q.maxQueriesSingleDay));

        this.repaint();
    }

    repaint(){
        chart.selectAll("*").remove();

        const xScale = d3.scaleTime()
            .domain([this.start.date, this.end.date])
            .range([0, WIDTH]);

        const yScale = d3.scaleLinear()
            .domain([0, this.maxQueriesSingleDay])
            .range([HEIGHT,0]);

        addGraph();
        drawAxes(xScale, yScale);
        this.queries.forEach(q => {
            drawLineGraph(q.tag, q.data, //fillInZeroes(q.data, this.start, this.end), broken somehow
                    q.color, xScale, yScale);
        });
    }

    tags(){
        return this.queries.map(q => q.tag);
    }

}


soChart = new StackOverflowChart();


function drawLineGraph(tag, data, colr, xScale, yScale){
    const lineGenerator = d3.line()
        .x(d => xScale(d[0]))
        .y(d => yScale(d[1]));

    addLayer()
        .append("path")
        .attr("d", lineGenerator(data))
        .style("stroke", colr)
        .style("stroke-width", 4)
        .style("fill", "none")
}


function drawAxes(xScale, yScale){
    const xAxis = d3.axisBottom().scale(xScale);
    const yAxis = d3.axisLeft().scale(yScale);
    addLayer()
        .attr("transform", `translate(${MARGIN.left},${MARGIN.top + HEIGHT})`)
        .call(xAxis);
    addLayer()
        .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`)
        .call(yAxis);
}


function addGraph(){

    // title
    addLayer().append("text")
        .attr("x", WIDTH / 2)
        .attr("y", -HEIGHT / 10)
        .classed("so-title", "true")
        .attr("text-anchor", "middle")
        .text("Queries Over Time");

    // x axis label
    addLayer().append("text")
        .attr("class", "x label")
        .attr("text-anchor", "end")
        .attr("x", WIDTH)
        .attr("y", HEIGHT - 6)
        .text("work days");

    // y axis label
    addLayer().append("text")
        .attr("class", "y label")
        .attr("text-anchor", "end")
        .attr("y", 6)
        .attr("dy", ".75em")
        .attr("transform", "rotate(-90)")
        .text("Queries with tag");
}


function setRelatedTags(tag){
    const RELATED_TAGS = 'https://api.stackexchange.com/2.2/tags/{0}/related?site=stackoverflow'
    const url = RELATED_TAGS.format(tag);
    const MAX_RELATED_TAGS = 10;
    $.getJSON(url, (data) => {
        // first item is tag itself, which we don't want.
        const related = data.items.map( blob => blob.name ).slice(1, MAX_RELATED_TAGS+1);
        app.relatedTags = related;
    });
}


function getData(tag, start, end){
    start = start.string;
    end = end.string;
    $.getJSON('data', { tag, start, end }, (data) => {
        console.log(data);
        // convert strings to dates
        const data_with_dates = data.results.map( (d) => [  new Date(d[0]), d[1] ] );
        soChart.addQuery(tag, data_with_dates);
    });
}


function setDate(start, end){
    if (! (start.equals(soChart.start) && end.equals(soChart.end)) ){
        const tags = soChart.tags();
        soChart.queries.forEach(q => soChart.removeQuery(q));
        soChart = new StackOverflowChart();

        // chart needs values to set align of x-axis
        soChart.start = start;
        soChart.end = end;

        tags.forEach(t => getData(t, start, end));

    }
}

function getNewTag(tag, start=soChart.start, end=soChart.end){
    getData(tag, start, end);
    app.currentTag = tag;
    setRelatedTags(tag);
}


$("#tagForm").submit( (e) => {
    e.preventDefault();
    const tag = $('#tag').val();
    const start = Datestring($('#start-date').val());
    const end = Datestring($('#end-date').val());

    setDate(start, end);

    if ( (tag.trim().length !=0) && ! soChart.tags().includes(tag)){
        getNewTag(tag, start, end);
    }
});

// initial querky
$("#start-date").val(START_DATE.string);
$("#end-date").val(END_DATE.string);
getNewTag('javascript', START_DATE, END_DATE);

});
