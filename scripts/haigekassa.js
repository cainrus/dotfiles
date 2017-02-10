#!/usr/bin/env node

var log = console.log;
console.log = function(){}

var execSync = require('child_process').execSync;
var options = {
  headers: {
    'Pragma': 'no-cache',
    'DNT': '1',
    'Accept-Encoding': 'gzip, deflate, sdch',
    'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4,et;q=0.2',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.102 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Cache-Control': 'no-cache',
    'Referer': 'https://digireg.keskhaigla.ee',
    'Connection': 'keep-alive'
  },
  host:'https://digireg.keskhaigla.ee',
  defaultFormFields: { //defaults.
    'HeaderSubView:socLang': '2',
    'selectOneChoice1':"0", // doctor type
    'selectOneChoice3':"", // place
    'id2': '',
    'Adf-Page-Id': 0,
    'event': 'cbSearch',
    'event.cbSearch': '<m+xmlns="http://oracle.com/richClient/comm"><k+v="type"><s>action</s></k></m>'
  }
}

function clone(a) {
   return JSON.parse(JSON.stringify(a));
}

function sleep(n) {
  n = n || 0;
  console.log('timeout', n);
  execSync("sleep " + n);
}

function read(list) {
  return require('readline-sync').keyInSelect(list, "Select the dr:\n")

}


function makeReqCmd (options) {
  var headers = options.headers;
  var headersStr = '';

  for (var i in headers) {
    headersStr += " -H '" + i + ': ' + headers[i] + "'";
  }

  var data = '';
  if (options.data) {
    for (var x in options.data) {
      data += x + '=' + options.data[x] + '&';
    }
    data = " --data '" + data + "'";
  }

  if (!options.url.match(/^http/)) {
    options.url = options.host + options.url;
  }

  return "curl  -L -v -sS '" + options.url + "' " + headersStr + data + " --compressed --stderr -"
}

function getForm(content, options) {
  var fields = options.defaultFormFields

  var form = /<form.+?<\/form>/.exec(content);
  if (!form) {
    return null;
  }

  form = form.pop();
  var options = {};
  options.url = /action="(.+?)"/g.exec(form).pop();

  // var re = /<select.+?id="selectOneChoice2".+?<\/select>/g;
  // var match;
  // var names = {};
  // while (match = re.exec(form)) {
  //   var select = match[match.length-1];
  //
  //   select = select.match(/<option[^>]+?value="([^"]+?)[^>]*?">([^<]+?)<\/option>/g);
  //   console.log(select)
  //   var name = select.pop();
  //   var value = select.pop();
  //   names[name] = value;
  // }
  //
  // read(Object.keys(names))

  form.match(/<input[^>]+?name="([^>]+?)"[^>]+?value="([^>]+?)">/mig).reduce(function(result, field){
    if (field.match(/type="radio"/)) {
      if (!field.match(/checked/)) {
        return result;
      }
    }
    var name = field.match(/name="([^"]+?)"/).pop();
    var value = field.match(/value="([^"]+?)"/).pop();
    result[name] = value;
    return result;
  }, fields);


  options.data = fields;
  return options;
}

function getMetaRedirectUrl(content) {
  return (/<meta.+refresh.+content=.+url=(.+)">/.exec(content)||[]).pop();
}

function getCode(content) {
  return (/<script>([^]+?)<\/script>/mig.exec(content)||[]).pop();
}


function evalCode(code, opts) {

  var url,referer;
  var href = opts.url;
  var cookies = '';
  var c = console;
  console = {
    log: function(a){
      c.log(a)
    }
  }
  var setTimeout = function(cb){
    cb();
  }
  var document = {
    location: {
      set href(v) {
        // c.log('set location.href=',(href=v));
      },
      get href() {
        // c.log('get location.href=',href);
        return href;
      },
      replace: function(v){
        url= v;
        // c.log('location.replace:'+v);
      }
    },
    get cookie (){
      c.log('cookie get:', cookies);
      return cookies;
    },
    set cookie (v){
      c.log('cookie set:', v);
      cookies += (";" + value);
    }
  };

  var navigator = {cookieEnabled: true};
  var window = {
    location: document.location,
    history: {
      replaceState: function(a,b,c){
        referer=c;
      }
    }
  }
  eval(code);

  return {
    url: url,
    referer: referer
  }
}

function processPage(options) {
  options = options || {};
  options.request = options.request || 0;
  options.request++;

  console.log(JSON.stringify(options, null ,2));

  var output = execSync(makeReqCmd(options)).toString();
  delete options.data; // clean post data after request.

  sleep(1);
  options.headers.Referer = options.url;
  options.headers.Cookie = /(JSESSIONID=[^;]+;)/.exec(output).pop();

  var url = getMetaRedirectUrl(output);
  if (output.indexOf('_rowCount') !== -1) {
    return output.match(/_rowCount="([^"]+)"/).pop();
  }
  else if (url) {
    options.url = url;
    console.log('meta redirect');
    return processPage(options);
  } else {
    // console.log(output)
    var code = getCode(output);

    if (code) {
      var codeResult = evalCode(code, options);
      if (codeResult.url) url = codeResult.url;

      if (url) {
        if (codeResult.referer) {
          options.headers.Referer = codeResult.referer;
        }
        options.url = url;
        console.log('js redirect');
        return processPage(options);
      }
    }
    var form = getForm(output, options);
    if (form) {
      console.log('form post');
      options.url = form.url;
      options.data = form.data;
      return processPage(options)

    }
  }
  console.log(output)
  console.log('\ndone\n');
}

var opts, result;


var doctor_ids = process.argv.slice(2);
doctor_ids.map(function(id){
	opts = Object.assign(clone(options), {
	  url: "https://digireg.keskhaigla.ee/Veebiregistratuur/faces/index.html"
	});
	opts.defaultFormFields.selectOneChoice2 = id; // l6ssenko
	result = processPage(opts);
	if (result > 0) {
	  return log('found ' + id);
	}
});