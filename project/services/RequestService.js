const _ = require('lodash');
const Request = require('request');

module.exports = {
  async requestPost(url = '', uri = '', body = {}, headers = {}) {
    let requestLink = `${url}`;
    if (uri) requestLink = `${url}${uri}`;
    const shortHeader = {};
    if (headers.authorization) {
      shortHeader.Authorization = headers.authorization;
    }
    const bodyOpts = {
      url: requestLink,
      body: JSON.stringify(body),
      headers: shortHeader
    };
    return new Promise((resolve, reject) => {
      try {
        Request.post(bodyOpts, (err, httpResponse, bodyResponse) => {
          if (!bodyResponse.startsWith('{')) {
            return resolve(bodyResponse);
          }
          return resolve(JSON.parse(bodyResponse));
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  async requestPut(url = '', uri = '', body = {}, headers = {}) {
    let requestLink = `${url}`;
    if (uri) requestLink = `${url}${uri}`;
    // console.log({ requestLink, body, headers });
    const shortHeader = {};
    if (headers.authorization) {
      shortHeader.Authorization = headers.authorization;
    }
    return new Promise((resolve, reject) => {
      Request.put({
        url: requestLink,
        body: JSON.stringify(body),
        headers: shortHeader
      }, (err, httpResponse, bodyResponse) => {
        // console.log(bodyResponse);
        if (err) return reject(err);
        if (!bodyResponse.startsWith('{')) {
          return resolve(bodyResponse);
        }
        return resolve(JSON.parse(bodyResponse));
      });
    });
  },

  async requestGet(url = '', uri = '', params = null, headers = null) {
    let requestLink = `${url}`;
    if (uri) requestLink = `${url}${uri}`;
    // console.log('requestLink:', requestLink);
    return new Promise((resolve, reject) => {
      const options = {
        url: requestLink
      };
      if (_.isEmpty(params) === false) {
        options.url = `${options.url}?${JSON.stringify(params)}`;
      }

      if (_.isEmpty(headers) === false) {
        options.headers = headers;
      }

      const startTime = new Date().getTime();
      console.log('options get', options);
      Request.get(options, (err, httpResponse, bodyResponse) => {
        // console.log('bodyResponse---------', bodyResponse);
        if (err) {
          reject(err);
        } else {
          resolve(JSON.parse(bodyResponse));
        }
      });
    });
  },

  async requestDelete(url = '', uri = '', body = {}, headers = {}) {
    let requestLink = `${url}`;
    if (uri) requestLink = `${url}${uri}`;
    return new Promise((resolve, reject) => {
      try {
        // console.log('----------------------------');
        // console.log({ url: requestLink, body: JSON.stringify(body), headers });
        const shortHeader = {};
        if (headers.authorization) {
          shortHeader.Authorization = headers.authorization;
        }
        Request.delete({
          url: requestLink,
          body: JSON.stringify(body),
          headers: shortHeader
        }, (err, httpResponse, bodyResponse) => {
          // console.log('bodyResponse', bodyResponse);
          // console.log('----------------------------');
          if (err) return reject(err);
          if (!bodyResponse.startsWith('{')) {
            return resolve(bodyResponse);
          }
          return resolve(JSON.parse(bodyResponse));
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  async requestOptions(options) {
    return new Promise((resolve, reject) => {
      try {
        Request(options, function (error, response, bodyResponse) {
          console.log('requestOptionsrequestOptionsrequestOptions', JSON.stringify({ options, error, response, bodyResponse }));
          if (error) return reject(error);
          if (!bodyResponse.startsWith('{')) {
            return resolve(bodyResponse);
          }
          return resolve(JSON.parse(bodyResponse));
        });
      } catch (error) {
        reject(error);
      }
    });
  }

};
