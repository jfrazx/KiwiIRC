var fs            = require('fs'),
    crypto        = require('crypto'),
    Promise       = require('es6-promise').Promise,
    sourceListing = require('./helpers/sourcelisting'),
    config        = require('./configuration.js');


module.exports.generate = generateSettings;
module.exports.get = getSettings;


// Cache for settings.json
var cached_settings = {
    debug: {
        hash: '',
        settings: ''
    },
    production: {
        hash: '',
        settings: ''
    }
};

// Clear the settings cache when the settings change
config.on('loaded', function () {
    cached_settings.debug.settings = cached_settings.production.settings = '';
    cached_settings.debug.hash = cached_settings.production.hash = '';
});




function getSettings(debug, callback) {
    var settings = cached_settings[debug ? 'debug' : 'production'];

    // Generate the settings if we don't have them cached as yet
    if (settings.settings === '') {
        generateSettings(debug).then(function (settings) {
            cached_settings[debug ? 'debug' : 'production'] = settings;
            callback(null, settings);
        }, function (err) {
            callback(err);
        });
    } else {
        callback(null, settings);
    }
}


/**
 * Generate a settings object for the client.
 * Settings include available translations, default client config, etc
 */
function generateSettings(debug) {
    var vars = {
            server_settings: {},
            client_plugins: [],
            translations: [],
            scripts: [
                [
                    'assets/libs/lodash.min.js'
                ],
                ['assets/libs/backbone.min.js', 'assets/libs/jed.js']
            ]
        };

    // Any restricted server mode set?
    if (config.get().restrict_server) {
        vars.server_settings = {
            connection: {
                server: config.get().restrict_server,
                port: config.get().restrict_server_port || 6667,
                ssl: config.get().restrict_server_ssl,
                allow_change: false
            }
        };
    }

    // Any client default settings?
    if (config.get().client) {
        vars.server_settings.client = config.get().client;
    }

    // Client transport specified?
    if (config.get().client_transports) {
        vars.server_settings.transports = config.get().client_transports;
    }

    // Any client plugins?
    if (config.get().client_plugins && config.get().client_plugins.length > 0) {
        vars.client_plugins = config.get().client_plugins;
    }

    addScripts(vars, debug);

    return Promise.all([addThemes().then(function (themes) {
        vars.themes = themes;
    }), addTranslations().then(function (translations) {
        vars.translations = translations;
    })]).then(function () {
        var settings = JSON.stringify(vars);
        return ({
            settings: settings,
            hash: crypto.createHash('md5').update(settings).digest('hex')
        });
    });
}


function addThemes() {
    return (config.get().client_themes || ['relaxed']).reduce(function (prom, theme) {
        return prom.then(function (themes) {
            return new Promise(function readThemeInfo(resolve, reject) {
                fs.readFile(global.config.public_http + '/assets/themes/' + theme.toLowerCase() + '/theme.json', function (err, theme_json) {
                    var theme;
                    if (err) {
                        return reject(err);
                    }

                    try {
                        theme = JSON.parse(theme_json);
                    } catch (e) {
                        return reject(e);
                    }

                    themes.push(theme);
                    resolve(themes);
                });
            });
        });
    }, Promise.resolve([]));
}

function addTranslations() {
    return new Promise(function (resolve, reject) {
        fs.readFile(global.config.public_http + '/src/translations/translations.json', function readTranslations(err, translations) {
            if (err) {
                return reject(err);
            }

            try {
                translations = JSON.parse(translations);
            } catch (e) {
                return reject(e);
            }

            fs.readdir(global.config.public_http + '/src/translations/', function readTranslationFile(err, pofiles) {
                var trans = [];

                if (err) {
                    return reject(err);
                }

                pofiles.forEach(function (file) {
                    var locale = file.slice(0, -3);
                    if ((file.slice(-3) === '.po') && (locale !== 'template')) {
                        trans.push({tag: locale, language: translations[locale]});
                    }
                });

                resolve(trans);
            });
        });
    });
}


function addScripts(vars, debug) {
    if (!debug) {
        vars.scripts.push([
            'assets/kiwi.min.js',
            'assets/libs/engine.io.bundle.min.js',
            'assets/libs/definenrequire.js'
        ]);
        return;
    }

    vars.scripts = vars.scripts.concat([
        [
            'assets/libs/engine.io.js',
            'assets/libs/engine.io.tools.js',
            'assets/libs/definenrequire.js'
        ]
    ]);

    var sources = sourceListing(global.config.public_http + '/src/').map(function(file) {
        // Strip the public_http path from the name as the http_base_path will be
        // appended by the client
        return file.replace(global.config.public_http + 'src/', 'src/');
    });

    vars.scripts = vars.scripts.concat(sources);
}
