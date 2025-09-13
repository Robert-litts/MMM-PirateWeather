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
  makeRequest: async function (requestUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
    try {
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'MMM-PirateWeather/1.0',
          'Accept': 'application/json',
          'Connection': 'close'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        let message;
        switch (response.status) {
          case 400:
            message = "Bad Request - Invalid latitude/longitude or language";
            break;
          case 401:
            message = "Unauthorized - Invalid API key";
            break;
          case 403:
            message = "Forbidden - API key doesn't have access to this endpoint";
            break;
          case 429:
            message = "Rate limit exceeded - Too many requests";
            break;
          case 500:
            message = "Server error - Retry the request";
            break;
          default:
            message = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(message);
      }
  
      const data = await response.json();
      return data;
  
    } catch (error) {
      throw new Error(`[MMM-PirateWeather] Request failed: ${error.message}`);
    } finally {
      clearTimeout(timeout);
    }
  },

  start: function() {
    console.log("Starting node_helper for module [" + this.name + "] - Using Pirate Weather API");
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === "PIRATE_WEATHER_GET") {
      var self = this;
  
      if (!payload.apikey) {
        console.log("[MMM-PirateWeather] " + this.formatTimestamp() + " ** ERROR ** No API key configured. Get one at https://pirateweather.net");
        return;
      }
      if (!payload.latitude || !payload.longitude) {
        console.log("[MMM-PirateWeather] " + this.formatTimestamp() + " ** ERROR ** Latitude and/or longitude not provided.");
        return;
      }
  
      // Build request URL
      var requestUrl = "https://api.pirateweather.net/forecast/" +
        payload.apikey + "/" +
        payload.latitude + "," + payload.longitude +
        "?units=" + payload.units +
        "&lang=" + payload.language;
  
      console.log("[MMM-PirateWeather] Getting data from Pirate Weather: " +
                  requestUrl.replace(payload.apikey, "***"));
  
      this.makeRequest(requestUrl)
        .then((data) => {
          data.instanceId = payload.instanceId;
          self.sendSocketNotification("PIRATE_WEATHER_DATA", data);
        })
        .catch((error) => {
          console.log("[MMM-PirateWeather] " + self.formatTimestamp() +
                      " ** ERROR ** " + error.message);
        });
    }
  },
});