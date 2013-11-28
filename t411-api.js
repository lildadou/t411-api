var async       = require('async');
var request     = require('request');
var qs          = require('qs');
var winston     = require('winston');

/**Cette classe a pour objectif de fournir une interface conviviale
 * avec l'API de T411. Pour plus de performance, les methodes sont
 * asynchrones. La classe possède 2 états : authentifié et
 * non-authentifié. Vous ne pourrez réaliser aucune opération
 * avant d'être authentifié (l'API T411 exige une authentification)
 *
 * Vous pouvez vous identifier via la méthode login
 * @property    {string}    apiUrl      L'URL de l'API de t411.me qui est utilisé par Client
 * @property    {string}    token       Jeton d'authentification utilisé par le client
 * @constructor
 */
T411ApiClient = function () {
    var _debug          = true;
    this.authenticated  = false;
    this.token          = null;
    this.logger = new (winston.Logger)({
        transports: [
            new (winston.transports.Console)({ level: (_debug)?'debug':'info' })
            //new (winston.transports.File)({ filename: 'somefile.log' })
        ]
    });
};
T411ApiClient.prototype = {
    /**L'URL par défaut de l'API de t411.me */
    apiUri      : 'https://api.t411.me',

    /**Méthode qui permet de vous authentifier et d'utiliser les
     * autres méthode de l'API une fois authentifié.
     * @param   {string}    username    String Le nom d'utilisateur
     * @param   {string}    password    Le mot de passe
     * @param   {function}  [callback]  Callback
     */
    login: function (username, password, callback) {
        this.logger.
        request({
            uri     : (this.apiUri+'/auth'),
            method  : 'POST',
            form    : {
                'username'    : username,
                'password'    : password
            }
        }, function(error, response, body) {
            var authResult  = JSON.parse(body);
            if (authResult.error) {
                logger.warn("L'authentification a échouée: (%d) %s", authResult.code, authResult.error);
            } else {
                logger.info("Authentification réussie");
                this.token = authResult.token;
            }
            if (typeof callback ==='function') callback();
        }.bind(this));
    },

    /**Indique si le client est dans l'état <em>authentifié</em>
     * @returns {Boolean}
     */
    isAuthenticated : function() { return (this.token != null); },

    prebuildApiRequest  : function(path) {
        return {
            uri         : this.apiUri+path,
            headers     : { 'Authorization': this.token}
        };
    },

    /**Effectue une recherche
     * @param   {SearchOptions} [options]   Les paramètres de recherche
     * @param   {function}      [callback]  Callback de résultat
     */
    rawSearch  : function(options, callback) {
        if (typeof options != 'object') options={};

        var hasQuery= (typeof options.query ==='string') && (options.query.length > 0);
        var baseUrl = '/torrents/search/'+(hasQuery)?options.query:'';
        var reqOpt  = this.prebuildApiRequest(baseUrl);
        if (typeof options.limit ==='number') reqOpt.qs.limit = options.limit;
        if (typeof options.offset ==='number') reqOpt.qs.offset = options.offset;
        if (typeof options.cid ==='number') reqOpt.qs.limit = options.cid;

        request(reqOpt, function(error, response, body) {
            var bodyLines   = body.split('\n');
            var reqResult   = JSON.parse((bodyLines.length>0)?bodyLines[3]:bodyLines[0]);
            var lastTorrents= reqResult.torrents;
            var createRequests = [];

            for (var itTorrent=0; itTorrent < lastTorrents.length; itTorrent++) {
                // Ici, on ajoute les tâches à la liste de tâches paralleles
                createRequests.push(function(tInfo, asyncFinish) {
                    // On mets les 2 sous-taches en series
                    // et en callback on met celui de la tâche!
                    async.series([
                        this.addTorrentEntry.bind(this, tInfo.entry),
                        this.addTorrentStatus.bind(this,tInfo.status)
                    ], asyncFinish);
                }.bind(this, this.extractTorrentInfos(lastTorrents[itTorrent])));
            }

            async.parallel(createRequests, callback);
        }.bind(this));
    }
};





/**Ensemble des paramètres utilisables lors d'une recherche de torrent
 * @property    {String}    [query=<empty>] L'expression de la recherche
 * @property    {number}    [limit=10]      Quantité de résultats maximal
 * @property    {number}    [offset=0]      Numéro de la page de recherche
 * @property    {number}    [cid=null]      Filtre de (sous-)catégorie
 * @constructor
 */
SearchOptions = function() {

};
SearchOptions.prototype = {
    query   : '',
    limit   : 10,
    offset  : 0,
    cid     : null
    //TODO: terms   : []
};

module.exports = {
    "ApiClient"      : T411ApiClient,
    "SearchOptions"  : SearchOptions
};