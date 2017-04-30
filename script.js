const RELATED_TAGS = 'https://api.stackexchange.com/2.2/tags/{0}/related?site=stackoverflow'
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
            normalized: false
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
        $.getJSON(url, CREDENTIALS, done);
    }

    function setRelatedTags(tag){
        const MAX_RELATED_TAGS = 10;
        fetchRelatedTags(tag, (data) => {
            const related = data.items.map( blob => blob.name ).slice(1, MAX_RELATED_TAGS+1);
            app.relatedTags = related;
            pieChart(app.currentTag, _.clone(related));
            tagGraph(_.clone(related));
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
                dataWithDates[i][0],
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

function fetchNewTags(){
    const newQuestionsURL = 'https://api.stackexchange.com/2.2/questions?pagesize=100&order=desc&sort=activity&site=stackoverflow'
    const MAX_TAGS = 10;
    $.getJSON(newQuestionsURL, CREDENTIALS, (data) => {
        console.log(data);
        const tags = _.uniq(_.flatten(data.items.map(q => q.tags))).slice(0, MAX_TAGS);
        app.newTags = tags;
    });
}

function pieChart(title, tags){
    console.log("loading pie chart for tags:", tags);
    let chart;
    const firsttag = tags.shift();
    const freqcount = (data) => filterTime(data).map(d => d[1]).reduce((a,b) => a + b);
    getData(firsttag, (data) => {
        console.log("pie data", data, filterTime(data));
        chart = c3.generate({
            bindto: '#pie',
            data: {
                columns: [
                [firsttag, freqcount(data)]
                ],
                type: 'pie',
                onclick: (d) => getNewTag(d.name),
            },
        });
        tags.forEach( (t) => getData(t, (data) => {
            console.log("pie: loading ", t, freqcount(data));
            chart.load({
                columns: [ [t, freqcount(data)] ]
                , onclick: (d, i) => { console.log(tag); }
            });
        }));
    });
}

function tagGraph(relatedTags){
    MAX_GRANDCHILDREN = 3;
    const graphJSON = [
    {
        name: app.currentTag,
        parent: null,
        children: [
        ]
    }
    ];
    const root = graphJSON[0];
    let counter = relatedTags.length;
    relatedTags.forEach(childTag => fetchRelatedTags(childTag, tags => {
        root.children.push({
            name: childTag,
            parent: app.currentTag,
            children: tags.items.slice(1, 1+MAX_GRANDCHILDREN).map( (grandChildTag) => {
                return {
                    name: grandChildTag.name,
                    parent: childTag,
                }
            })
        });
        counter--; // UNSAFE RACE CONDITION
        if (counter == 0){
            drawSVG(graphJSON);
        }
    }
    ));
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


    // initial querky
    $("#start-date").val(START_DATE.string);
    $("#end-date").val(END_DATE.string);
    getNewTag('JavaScript', START_DATE, END_DATE);

    fetchNewTags();
    setInterval(fetchNewTags, 60000);

// TreeStuff


var treeData = [
{
    "name": "Top Level",
    "parent": "null",
    "children": [
    {
        "name": "Level 2: A",
        "parent": "Top Level",
        "children": [
        {
            "name": "Son of A",
            "parent": "Level 2: A"
        },
        {
            "name": "Daughter of A",
            "parent": "Level 2: A"
        }
        ]
    },
    {
        "name": "Level 2: B",
        "parent": "Top Level"
    }
    ]
}
];

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

    var svg = d3.select("body").append("svg")
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
        d.children = d._children;
        d._children = null;
    }
    update(d);
}

}

drawSVG(treeData);
});
