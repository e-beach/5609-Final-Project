const RELATED_TAGS = 'https://api.stackexchange.com/2.2/tags/{0}/related?site=stackoverflow';
const TOP_TAGS = 'https://api.stackexchange.com/2.2/tags?order=desc&sort=popular&site=stackoverflow';
const FETCH_NEW_TAGS_INTERVAL = 8000;
const CREDENTIALS = {
    key:  'Q5zLQ3dmjTTgLTI4ize63A(('
};

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
            date: moment(s),
            equals: (d) => d.string === s
        }
    }

    const START_DATE = Datestring('2008-01-01');
    const END_DATE = Datestring('2017-03-13');

    Vue.component('tag-link', {
        props: ['tag', 'action'],
        template: `
        <div v-on:click="action(tag)" class="row">
        <div class="btn btn-default col-xs-12">
        {{ tag }}
        </div>
        </div>
        `,
    });

    window.app = new Vue({
        el: '#app',
        data: {
            title : "Stack Overflow Tag Visualization",
            relatedTags: [ ],
            currentTag: "",
            // set later
            soChart: {},
            newTags: [],
            topTags: [],
            normalized: false,
        },
        // expose these to html
        methods: {
            getNewTag,
        }
    });

    class StackOverflowChart {

        constructor(){
            this.queries = [];
            this.color = -1;
            this.start = START_DATE;  // positive inifinity
            this.end =  END_DATE;  // negative infinity
        }

        reset(start, end){
            this.chart.unload(); // remove all data
            delete this.chart;

            // reset other stuff
            this.queries = [];
            this.color = -1;
            this.start = start;
            this.end =  end;
        }

        nextColor(){
            const scale = d3.scale.category20().domain(_.range(20));
            this.color = (this.color + 1) % 10;
            return scale(this.color);
        }

        addQuery(tag, data){
            const query = { tag, data, color: this.nextColor() };
            this.queries.push(query);

            const format = {
                bindto: '#svg-container',
                data: {
                    xs: {
                        [tag] : 'date'
                    },
                    rows: [['date', tag]].concat(query.data),
                    type: 'spline',
                    colors: {
                        [tag]: query.color,
                    }
                },
                axis: {
                    x: {
                        type: 'timeseries',
                        tick: {
                            // TODO customize based on range.
                            format: (d) => moment(d).format("MM/DD/YY")
                        }
                    }
                },
            };

            // add the query to the chart
            if (this.chart === undefined){
                this.chart = c3.generate(format);
            } else {
                this.chart.load(format.data);
            }

        }

        removeQuery(query){
            this.chart.unload(query.tag);
            console.log('before', this.queries);
            this.queries = this.queries.filter(q => q !== query);
            console.log('after', this.queries);
        }

        tags(){
            return this.queries.map(q => q.tag);
        }

    }

    app.soChart = soChart = new StackOverflowChart();

    function fetchRelatedTags(tag, done){
        const url = RELATED_TAGS.format(tag);
        $.getJSON(url, CREDENTIALS, tag => done(tag.items));
    }

    function setRelatedTags(tag){
        const MAX_RELATED_TAGS = 10;
        fetchRelatedTags(tag, (data) => {
            const related = data.map( blob => blob.name ).slice(1, MAX_RELATED_TAGS+1);
            app.relatedTags = related;
            pieChart(app.currentTag, data);
            if (! app.isTagGraphDrawn ){
                tagGraph(_.clone(related));
            };
        });
    }

    function getData(tag, done){
        $.getJSON('data', { tag }, (data) => done(data.results));
    }

    function filterTime(data, start=soChart.start, end=soChart.end){
       start = start.string;
       end = end.string;
       return data.filter( (d) => start <= d[0] && d[0] <= end);
   }

   function addTagToChart(tag, start, end){
    const MAX_POINTS = 25;
    getData(tag, (data) => {
        const dataWithDates = filterTime(data, start, end).map( (d) => [ new Date(d[0]), d[1] ] );
        const stride = Math.ceil(dataWithDates.length / MAX_POINTS);
        const smoothedOut = [];
        for(let i = 0; i < dataWithDates.length; i += stride){
            let avg = 0;
            let j;
            for(j = 0; j < stride && i +j < dataWithDates.length; j++){
                avg += dataWithDates[i+j][1];
            }
            avg = avg / j;
            smoothedOut.push([
                dataWithDates[i+Math.round(j/2)][0],
                avg
                ]);
        }
        soChart.addQuery(tag, smoothedOut);
    });
}


function setDate(start, end){
    if (! (start.equals(soChart.start) && end.equals(soChart.end)) ){
        const tags = soChart.tags();
        soChart.reset(start, end);
        tags.forEach(t => addTagToChart(t, start, end));
    }
}

function getNewTag(tag, start=soChart.start, end=soChart.end){
    addTagToChart(tag, start, end);
    app.currentTag = tag;
    setRelatedTags(tag);
}

const MAX_TAGS = 10;
function fetchNewTags(){
    const newQuestionsURL = 'https://api.stackexchange.com/2.2/questions?pagesize=100&order=desc&sort=activity&site=stackoverflow'
    $.getJSON(newQuestionsURL, CREDENTIALS, (data) => {
        console.log(data);
        const tags = _.uniq(_.flatten(data.items.map(q => q.tags))).slice(0, MAX_TAGS);
        app.newTags = tags;
    });
}

function fetchTopTags(){
    $.getJSON(TOP_TAGS, CREDENTIALS, (data) => {
        const tags = data.items.map(blob => blob.name).slice(0, MAX_TAGS);
        app.topTags = tags;
    })
}

function pieChart(title, tagdata){
    const MAX_PIE_TAGS = 10;
    const columns = tagdata.splice(1,MAX_PIE_TAGS+1).map( t => [
            t.name,
            t.count,
        ]);
    c3.generate({
        bindto: '#pie',
        data: {
            columns,
            type: 'pie',
            onclick: (d) => getNewTag(d.name),
        }
    });
}

const LOADED_TAGS = new Set();
const MAX_CHILDREN = 5;
function populateNode(node, done){
    node.children = node.children || [];
    fetchRelatedTags(node.name, tags => {
        tags = tags.map(t=>t.name);
        const tagsToDisplay = tags.filter( (t) => !LOADED_TAGS.has(t) ).slice(0, MAX_CHILDREN);
        node.children = tagsToDisplay.map( (childTag) => ({
                name: childTag,
                parent: node.name,
        }));
        tagsToDisplay.forEach( (t) => LOADED_TAGS.add(t) );
        if (done){
            done(node);
        }
    });
}


function tagGraph(relatedTags){
    app.isTagGraphDrawn = true;
    const graphJSON = [{
        name: app.currentTag,
        parent: null,
    }];
    const root = graphJSON[0];

    populateNode(root, () => {
      drawSVG(graphJSON);
  });
}

$("#tagForm").submit( (e) => {
    e.preventDefault();
    const tag = $('#tag').val();
    const start = Datestring($('#start-date').val());
    const end = Datestring($('#end-date').val());

    if ( (tag.trim().length !=0) && ! soChart.tags().includes(tag)){
        getNewTag(tag, start, end);
    }
    setDate(start, end); // possible race condition if server query in getNewTag returns before setDate, but this will probably never happen.
 });


// initial query
$("#start-date").val(START_DATE.string);
$("#end-date").val(END_DATE.string);
getNewTag('JavaScript', START_DATE, END_DATE);

fetchNewTags();
fetchTopTags();
setInterval(fetchNewTags, FETCH_NEW_TAGS_INTERVAL);

// TreeStuff

function drawSVG(data){

    var margin = {top: 0, right: 120, bottom: 20, left: 120},
    width = 960 - margin.right - margin.left,
    height = 500 - margin.top - margin.bottom;

    var i = 0,
    duration = 750,
    root;

    var tree = d3.layout.tree()
    .size([height, width]);

    var diagonal = d3.svg.diagonal()
    .projection(function(d) { return [d.y, d.x]; });

    var svg = d3.select("#simple").append("svg")
    .attr("width", width + margin.right + margin.left)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    root = data[0];
    root.x0 = height / 2;
    root.y0 = 0;

    update(root);

    function update(source) {

    // Compute the new tree layout.
    var nodes = tree.nodes(root).reverse(),
    links = tree.links(nodes);

    // Normalize for fixed-depth.
    nodes.forEach(function(d) { d.y = d.depth * 180; });

    // Update the nodes…
    var node = svg.selectAll("g.node")
    .data(nodes, function(d) { return d.id || (d.id = ++i); });

    // Enter any new nodes at the parent's previous position.
    var nodeEnter = node.enter().append("g")
    .attr("class", "node")
    .attr("transform", function(d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
    .on("click", click);

    nodeEnter.append("circle")
    .attr("r", 1e-6)
    .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

    nodeEnter.append("text")
    .attr("x", function(d) { return d.children || d._children ? -13 : 13; })
    .attr("dy", ".35em")
    .attr("text-anchor", function(d) { return d.children || d._children ? "end" : "start"; })
    .text(function(d) { return d.name; })
    .style("fill-opacity", 1e-6);

    // Transition nodes to their new position.
    var nodeUpdate = node.transition()
    .duration(duration)
    .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

    nodeUpdate.select("circle")
    .attr("r", 10)
    .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

    nodeUpdate.select("text")
    .style("fill-opacity", 1);

    // Transition exiting nodes to the parent's new position.
    var nodeExit = node.exit().transition()
    .duration(duration)
    .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
    .remove();

    nodeExit.select("circle")
    .attr("r", 1e-6);

    nodeExit.select("text")
    .style("fill-opacity", 1e-6);

    // Update the links…
    var link = svg.selectAll("path.link")
    .data(links, function(d) { return d.target.id; });

    // Enter any new links at the parent's previous position.
    link.enter().insert("path", "g")
    .attr("class", "link")
    .attr("d", function(d) {
        var o = {x: source.x0, y: source.y0};
        return diagonal({source: o, target: o});
    });

    // Transition links to their new position.
    link.transition()
    .duration(duration)
    .attr("d", diagonal);

    // Transition exiting nodes to the parent's new position.
    link.exit().transition()
    .duration(duration)
    .attr("d", function(d) {
        var o = {x: source.x, y: source.y};
        return diagonal({source: o, target: o});
    })
    .remove();

    // Stash the old positions for transition.
    nodes.forEach(function(d) {
        d.x0 = d.x;
        d.y0 = d.y;
    });
}

// Toggle children on click.
function click(d) {
    if (d.children) {
        d._children = d.children;
        d.children = null;
    } else {
        if(d._children){
         d.children = d._children;
         d._children = null;
     } else {
        populateNode(d, () => {
            update(d);
            getNewTag(d.name);
        });
        return;
    }
}
update(d);
}

}
});
