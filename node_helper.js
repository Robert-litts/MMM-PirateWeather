/*********************************
  Node Helper for MMM-PirateWeather.
  This helper is responsible for the data pull from Pirate Weather API.
  At a minimum the API key, Latitude and Longitude parameters
  must be provided.  If any of these are missing, the request
  to Pirate Weather will not be executed, and instead an error
  will be output to the MagicMirror log.
  Additionally, this module supplies two optional parameters:
    units - one of "ca", "uk", "us", or "si"
    lang - Any of the languages supported by Pirate Weather
  The Pirate Weather API request is formatted as follows:
    https://api.pirateweather.net/forecast/API_KEY/LATITUDE,LONGITUDE?units=XXX&lang=YY
*********************************/
var NodeHelper = require("node_helper");
var https = require("https");
var url = require("url");

module.exports = NodeHelper.create({
  // Helper function to format current timestamp
  formatTimestamp: function() {
    const now = new Date();
    const day = now.getDate();
    const month = now.toLocaleString('en', { month: 'short' });
    const year = now.getFullYear().toString().slice(-2);    
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  },

  // Helper function to make HTTPS requests
   makeRequest: function(requestUrl, callback) {
      //console.log("[MMM-PirateWeather] Making request to:", requestUrl);
      
      const parsedUrl = new URL(requestUrl);
      
      const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname + parsedUrl.search,  // Fixed: combine pathname and search
        method: 'GET',
        timeout: 10000,
        headers: {
          'User-Agent': 'MMM-PirateWeather/1.0',
          'Accept': 'application/json',
          'Connection': 'close'
        }
      };
        
      const req = https.request(options, (res) => {
        
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          callback(null, res, data);
        });
      });
    
      req.on('error', (error) => {
        callback(error, null, null);
      });
    
      req.on('timeout', () => {
        req.destroy();
        callback(new Error('Request timeout'), null, null);
      });
    
      req.setTimeout(10000);
      req.end();
    },

  start: function() {
    console.log("====================== Starting node_helper for module [" + this.name + "] - Using Pirate Weather API");
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === "PIRATE_WEATHER_GET") {
      var self = this;
      
      if (payload.apikey == null || payload.apikey == "") {
        console.log("[MMM-PirateWeather] " + this.formatTimestamp() + " ** ERROR ** No API key configured. Get an API key at https://pirateweather.net");
      } else if (payload.latitude == null || payload.latitude == "" || payload.longitude == null || payload.longitude == "") {
        console.log("[MMM-PirateWeather] " + this.formatTimestamp() + " ** ERROR ** Latitude and/or longitude not provided.");
      } else {
        // Pirate Weather API requesr
        var requestUrl = "https://api.pirateweather.net/forecast/" +
          payload.apikey + "/" +
          payload.latitude + "," + payload.longitude +
          "?units=" + payload.units +
          "&lang=" + payload.language;
          // "&exclude=minutely"

        console.log("[MMM-PirateWeather] Getting data from Pirate Weather: " + requestUrl.replace(payload.apikey, "***"));
        
        this.makeRequest(requestUrl, function(error, response, body) {
          if (!error && response.statusCode == 200) {
            try {
              // Good response
              var resp = JSON.parse(body);
              resp.instanceId = payload.instanceId;
              self.sendSocketNotification("PIRATE_WEATHER_DATA", resp);
            } catch (parseError) {
              console.log("[MMM-PirateWeather] " + self.formatTimestamp() + " ** ERROR ** Failed to parse response: " + parseError);
            }
          } else if (response && response.statusCode) {
            // Handle specific HTTP error codes
            switch (response.statusCode) {
              case 400:
                console.log("[MMM-PirateWeather] " + self.formatTimestamp() + " ** ERROR ** Bad Request - Invalid latitude/longitude or language");
                break;
              case 401:
                console.log("[MMM-PirateWeather] " + self.formatTimestamp() + " ** ERROR ** Unauthorized - Invalid API key");
                break;
              case 403:
                console.log("[MMM-PirateWeather] " + self.formatTimestamp() + " ** ERROR ** Forbidden - API key doesn't have access to this endpoint");
                break;
              case 429:
                console.log("[MMM-PirateWeather] " + self.formatTimestamp() + " ** ERROR ** Rate limit exceeded - Too many requests");
                break;
              case 500:
                console.log("[MMM-PirateWeather] " + self.formatTimestamp() + " ** ERROR ** Server error - Retry the request");
                break;
              default:
                console.log("[MMM-PirateWeather] " + self.formatTimestamp() + " ** ERROR ** HTTP " + response.statusCode + ": " + (error || "Unknown error"));
            }
          } else {
            console.log("[MMM-PirateWeather] " + self.formatTimestamp() + " ** ERROR ** " + (error || "Network error"));
          }
        });
      }
    }
  },
});