#!/usr/bin/env node

var config = require('./config.js');

if (!config || config.emails instanceof Array === false || config.emails.length === 0) {
  console.log('Unable to read list of emails from config.json. Example: module.exports={"emails":["mary@jane.bb", "john@smith.com"]}');
}


Date.prototype.getWeekNumber = function(){
    var d = new Date(+this);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate()+4-(d.getDay()||7));
    return Math.ceil((((d-new Date(d.getFullYear(),0,1))/8.64e7)+1)/7);
};


function readUrl(url) {

	return new Promise(function(resolve, reject){
		require('http').get(url).on('response', function (response) {

			if (response.statusCode !== 200) throw new Error('Invalid response status: ' + response.statusCode);
		    var body = '';
		    var i = 0;
		    response.on('data', function (chunk) {
		        i++;
		        body += chunk;
		    });
		    response.on('end', function () {
		        resolve(body);
            });
		}).on('error', reject);
	})
}

function getMonday(d) {
  var now = new Date();

  if (now > d)
  d = new Date(d);
  if (day > 4) 7 - day
  var day = d.getDay(),
      diff = d.getDate() - day + (day == 0 ? -6:1); // adjust when day is sunday
  return new Date(d.setDate(diff));
}

var d = new Date();
d = getMonday(d);
// Week number from year start.
var y = d.getFullYear();
var w = d.getWeekNumber();
// Url
var closedRegExp = /\bkohad\st.+is\b/i
var offset = 0;

var getUrl = function() {
	return "http://client.bronn.ee/book_groups/week/130/"+ w +"/" + y
}


function readDB() {
	try {
		return require('./db_' + y + '.json');
	} catch (e) {
		return {};
	}
}
function writeDB(data) {
	require('fs').writeFile('./db_' + y + '.json', JSON.stringify(data), (err) => {
	  if (err) throw err;
	});
}

var dbRecords = readDB();
var isRemoved = false;
var updates = [];


function process() {

console.log(`processing week#${w}`);
return readUrl(getUrl()).then(function(html) {
  var logList = [];

  var $ = require('cheerio').load(html);
  var $table = $('#bookings');
  var $trs = $table.children('tr:nth-child(n+2)');
  if ($trs.length === 0) throw new Error('No entries');
  var dayTitles = $('th.bookings_table_header', $table).map(function(){return $(this).text().replace(/(\w)(\d)/, '$1 $2'); }).toArray()

  var tr = $trs.map(function(){
	  var $tr = $(this);
	  var time = $tr.children('.time').eq(0).text();
	  var $cells = $tr.children('td.bookings_table_back');
	  $cells.map(function(i){
		  var day = dayTitles[i];
		  var date = day.split(' ').pop();
		  var $cell = $(this);
		  var $cells = $cell.find('td');
          $cells.map(function(i) {
			  var $cell = $(this);
			  var lessonText = $cell.find('span').text();
              var inStorage = Boolean(dbRecords[date] && dbRecords[date][time] && dbRecords[date][time][i]);
			  var isFree = !closedRegExp.test(lessonText);
			  // logList.push(`${date} ${time}: ${isFree}`);

// console.log("000")
// console.log(`is free: ${isFree}, is storage: ${inStorage}`)
              if (!isFree && !inStorage) return;
              if (isFree && inStorage) return;
// console.log("001")
			  if (!isFree && inStorage) {
				  delete dbRecords[date][time][i];
				  isRemoved = true;
				  return			  	
			  }

			  lessonText = `Time: ${day} ${time}\nTitle: ` +
				  	lessonText
					  .replace(/^\W+/, '')
					  .replace(/[\t ]+/g, ' ')
					  .replace(/:\s+/g, ': ')
					  .replace(/\s*\n\s*/g, '\n')
				      .replace(/\n$/, '');
console.log(111)
			  dbRecords[date] = dbRecords[date] || {};
			  dbRecords[date][time] = dbRecords[date][time] || {};	  
			  dbRecords[date][time][i] = lessonText;
console.log(222)
			  updates.push(lessonText);
console.log(333)
          })
	  })
  });
  
  logList = logList.sort();
  for (var i=0; i<logList.length; i++) {
	  console.log(logList[i]);
  }
 
 
}).then(function(){
	
    console.log('updates.length:', updates.length);
	
	w++;
	return process();
})
}


process().catch(function(e){
	console.log(e.message)
	if (isRemoved || updates.length) {
	    writeDB(dbRecords);  	
	}
	if (updates.length) {
		console.log('updates: ',updates);
		const sendmail = require('sendmail')();
		sendmail({
		    from: 'pool-updates@localhost',
		    to: config.emails.join(', '),
		    subject: 'pool registration',
		    text: updates.join("\n\n\n"),
		  }, function(err, reply) {
		    console.log(err && err.stack);
		    console.dir(reply);
		});
	} else {
		console.log('no updates');
	}

})

