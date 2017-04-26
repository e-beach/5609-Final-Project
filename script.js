$(function(){
const START_DATE = '2017-01-01';
const END_DATE = '2017-03-13';

var app = new Vue({
    el: '#app',
    data: {
        title : "Stack Overflow Tag Visualization",
        start: START_DATE,
        end: END_DATE
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
        this.dateStart = new Date(START_DATE);  // positive inifinity
        this.dateEnd =  new Date(END_DATE);  // negative infinity
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
            // We are allowing the user to select the start and end date, rather than the range of data.
            // this.dateStart = new Date(Math.min(this.dateStart, d3.min(data, d=>d[0])));
            // this.dateEnd = new Date(Math.max(this.dateEnd, d3.max(data, d=>d[0])));
        }

        this.addButton(query);
        this.repaint();
    }


    addButton(query){
        const div = $('<div/>', {
            class: 'list-group-item',
            text:  " " + query.tag,
            style: `border-color: ${query.color}; border-width: 4px`,
        }).prepend($('<span/>', {
            class: "glyphicon glyphicon-trash",
            style: `color: ${query.color}`
                //style: `color: red`,
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
            .domain([this.dateStart, this.dateEnd])
            .range([0, WIDTH]);

        const yScale = d3.scaleLinear()
            .domain([0, this.maxQueriesSingleDay])
            .range([HEIGHT,0]);

        addGraph();
        drawAxes(xScale, yScale);
        this.queries.forEach(q => {
            drawLineGraph(q.tag, q.data, //fillInZeroes(q.data, this.dateStart, this.dateEnd), broken somehow
                    q.color, xScale, yScale);
        });
    }

    tags(){
        return this.queries.map(q => q.tag);
    }

}


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
        .attr("text-anchor", "middle")
        .style("font-size", "30px")
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


// convert data that may have few values to be 0
// between start date and stop date.
function fillInZeroes(data, startDate, stopDate){
    console.log(data, startDate, stopDate);
    const results = [];
    let i = 0;
    let count;
    for(let d = new Date(startDate); d <= stopDate; d.setDate(d.getDate()+1)){
        if (i < data.length && data[i][0].getTime() === d.getTime()){
            count = data[i][1];
            i++;
        } else {
            count = 0;
        }
        results.push([new Date(d), count]);
    }
    return results;
}

function getData(tag, start, end){
    $.getJSON('data', { tag, start, end }, (data) => {
        console.log(data);
        // convert strings to dates
        const data_with_dates = data.results.map( (d) => [  new Date(d[0]), d[1] ] );
        soChart.addQuery(tag, data_with_dates);
    });
}

let soChart = new StackOverflowChart();
getData('JavaScript', START_DATE, END_DATE);

function setDate(start, end){
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (soChart.dateStart.getTime() !== startDate.getTime() || soChart.dateEnd.getTime() !== endDate.getTime()){
        soChart.queries.forEach(q => soChart.removeQuery(q));
        const tags = soChart.tags();
        soChart = new StackOverflowChart();
        tags.forEach(t => getData(t, start, end));

        // chart needs values to set align of x-axis
        soChart.dateStart = startDate;
        soChart.dateEnd = endDate;
    }
}

$("#tagForm").submit( (e) => {
    e.preventDefault();
    const tag = $('#tag').val();
    const start = $('#start-date').val();
    const end = $('#end-date').val();

    setDate(start, end);

    if ( (tag.trim().length !=0) && ! soChart.tags().includes(tag)){
        getData(tag, start, end);
    }
});

$("#start-date").val(START_DATE);
$("#end-date").val(END_DATE);
});