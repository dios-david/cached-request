var log4js = require('log4js'),
    moment = require('moment'),
    Q = require('q'),
    request = require('request'),
    instances = 0;

/**
 * @class CachedRequest
 * @param params
 * @constructor
 * @example
 *      new CachedRequest({
 *          cacheThreshold: 10, //in minutes, default: 1
 *          auth: { //optional
 *              user: "foo",
 *              pass: "bar"
 *          },
 *          logging: true //default: false
 *      });
 */
var CachedRequest = function(params) {
    var config = Object.assign({}, {
        cacheThreshold: 1,
        auth: null,
        logging: false
    }, params);

    this.cache = {};
    this.cacheThreshold = config.cacheThreshold;
    this.auth = config.auth;
    this.logging = config.logging;
    this.logger = log4js.getLogger('CachedRequest #' + instances++);

    if(!this.logging) {
        this.logger.setLevel(log4js.levels.OFF);
    }
};

CachedRequest.prototype = {
    /**
     * @property cacheThreshold
     * @type number
     */
    cacheThreshold: 0,

    /**
     * @property cache
     * @type object
     */
    cache: {},

    /**
     * @method get
     * @param url
     */
    get: function(url) {
        var deferred = Q.defer(),
            cachedData = this.cache[url];

        if(cachedData) {
            if (moment(cachedData.time).isAfter(moment().subtract(this.cacheThreshold, 'minutes'))) {
                this.logger.info(url, 'has a valid cache');
                deferred.resolve(cachedData.data);
                return deferred.promise;

            } else {
                this.logger.info(url, 'has a cache but its expired');
                delete this.cache[url];
            }
        }

        this.logger.info(url, 'has no cache');
        return this.request(url, 'GET');
    },

    /**
     * @method post
     * @param url
     * @param postData
     */
    post: function(url, postData) {
        var deferred = Q.defer(),
            cachedData = this.cache[url + JSON.stringify(postData)];

        if(cachedData) {
            if (moment(cachedData.time).isAfter(moment().subtract(this.cacheThreshold, 'minutes'))) {
                this.logger.info(url, 'has a valid cache');
                deferred.resolve(cachedData.data);
                return deferred.promise;

            } else {
                this.logger.info(url, 'has a cache but its expired');
                delete this.cache[url];
            }
        }

        this.logger.info(url, 'has no cache');
        return this.request(url, 'POST', postData);
    },

    /**
     * @method request
     * @param url
     * @param method
     * @param postData
     */
    request: function(url, method, postData) {
        var deferred = Q.defer(),
            self = this;

        this.logger.info(url, 'request started');

        request({
            url: url,
            method: method,
            form: postData,
            auth: this.auth,
            rejectUnauthorized : false
        }, function (error, response, body) {
            if (error) {
                deferred.reject(error);
            } else {
                deferred.resolve(body);
            }
        });

        Q.when(deferred.promise,
            function (data) {
                self.logger.info(url, 'request success');
                self.storeCache(postData ? url + JSON.stringify(postData) : url, data);
            },
            function (error) {
                self.logger.warn(url, 'request error');
            }
        );

        return deferred.promise;
    },

    /**
     * @method storeCache
     * @param url
     * @param data
     */
    storeCache: function(url, data) {
        this.cache[url] = new CachedRequestObject(url, data, new Date());
    }
};

/**
 * @class CachedRequestObject
 * @param url
 * @param data
 * @param time
 * @constructor
 */
CachedRequestObject = function(url, data, time) {
    this.url = url;
    this.data = data;
    this.time = time;
};

module.exports = CachedRequest;
