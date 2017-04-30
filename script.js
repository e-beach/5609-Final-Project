$(function(){
let soChart

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

const START_DATE = Datestring('2017-01-01');
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

function setRelatedTags(tag){
    const RELATED_TAGS = 'https://api.stackexchange.com/2.2/tags/{0}/related?site=stackoverflow'
    const MAX_RELATED_TAGS = 10;
    const url = RELATED_TAGS.format(tag);
    $.getJSON(url, (data) => {
        // first item is tag itself, which we don't want.
        const related = data.items.map( blob => blob.name ).slice(1, MAX_RELATED_TAGS+1);
        app.relatedTags = related;
    });
}


function getData(tag, start, end){
    start = start.string;
    end = end.string;
    $.getJSON('data', { tag }, (data) => {
        const dataInRange = data.results.filter( (d) => start <= d[0] && d[0] <= end);
        const dataWithDates = dataInRange.map( (d) => [ new Date(d[0]), d[1] ] );
        soChart.addQuery(tag, dataWithDates);
    });
}


function setDate(start, end){
    if (! (start.equals(soChart.start) && end.equals(soChart.end)) ){
        const tags = soChart.tags();
        soChart.reset(start, end);
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

    if ( (tag.trim().length !=0) && ! soChart.tags().includes(tag)){
        getNewTag(tag, start, end);
    }

    setDate(start, end); // possible race condition if server query in getNewTag returns before setDate, but this will probably never happen.
});

// initial querky
$("#start-date").val(START_DATE.string);
$("#end-date").val(END_DATE.string);
getNewTag('JavaScript', START_DATE, END_DATE);

function fetchNewTags(){
    const newQuestionsURL = 'https://api.stackexchange.com/2.2/questions?pagesize=100&order=desc&sort=activity&site=stackoverflow'
    const MAX_TAGS = 10;
    $.getJSON(newQuestionsURL, (data) => {
        console.log(data);
        const tags = _.uniq(_.flatten(data.items.map(q => q.tags))).slice(0, MAX_TAGS);
        app.newTags = tags;
    });
}

fetchNewTags();
setInterval(fetchNewTags, 60000);

});
