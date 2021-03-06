define('misc/clientuicommands', function(require, exports, module) {

    var utils = require('helpers/utils');

    module.exports = ClientUiCommands;

    function ClientUiCommands(app, controlbox) {
        this.app = app;
        this.controlbox = controlbox;

        this.addDefaultAliases();
        this.bindCommand(fn_to_bind);
    };

    // Add the default user command aliases
    ClientUiCommands.prototype.addDefaultAliases = function() {
        $.extend(this.controlbox.preprocessor.aliases, {
            // General aliases
            '/p':        '/part $1+',
            '/me':       '/action $1+',
            '/j':        '/join $1+',
            '/q':        '/query $1+',
            '/w':        '/whois $1+',
            '/raw':      '/quote $1+',
            '/connect':  '/server $1+',

            // Op related aliases
            '/op':       '/quote mode $channel +o $1+',
            '/deop':     '/quote mode $channel -o $1+',
            '/hop':      '/quote mode $channel +h $1+',
            '/dehop':    '/quote mode $channel -h $1+',
            '/voice':    '/quote mode $channel +v $1+',
            '/devoice':  '/quote mode $channel -v $1+',
            '/k':        '/kick $channel $1+',
            '/ban':      '/quote mode $channel +b $1+',
            '/unban':    '/quote mode $channel -b $1+',

            // Misc aliases
            '/slap':     '/me slaps $1 around a bit with a large trout',
            '/tick':     '/msg $channel ✔'
        });
    };


    /**
     * Add a new command action
     * @var command Object {'command:the_command': fn}
     */
    ClientUiCommands.prototype.bindCommand = function(command) {
        var that = this,
            descriptions = {};

        _.each(command, function(fn, event_name) {
            var command_fn;
            if (typeof fn === 'function') {
                command_fn = fn;
            } else {
                command_fn = fn.fn;
                descriptions['/' + event_name.split(':')[1]] = fn.description;
            }

            that.controlbox.on(event_name, _.bind(command_fn, that));
        });

        this.controlbox.setAutoCompleteCommands(descriptions);
    };




    /**
     * Default functions to bind to controlbox events
     **/

    var fn_to_bind = {
        'unknown_command':     unknownCommand,
        'command':             allCommands,
        'command:msg':         {fn: msgCommand, description: 'Send a message'},
        'command:action':      {fn: actionCommand, description: 'Do something physical'},
        'command:join':        {fn: joinCommand, description: 'Join a channel'},
        'command:part':        {fn: partCommand, description: 'Leave a channel'},
        'command:cycle':       {fn: cycleCommand, description: 'Leave, then re-join a channel'},
        'command:nick':        {fn: nickCommand, description: 'Change your nickname'},
        'command:query':       {fn: queryCommand, description: 'Start a private message with someone'},
        'command:invite':      {fn: inviteCommand, description: 'Invite somebody into the channel'},
        'command:topic':       {fn: topicCommand, description: 'Set the topic for this channel'},
        'command:notice':      {fn: noticeCommand, description: 'Send a notice'},
        'command:quote':       {fn: quoteCommand, description: 'Send a raw command to the IRC server'},
        'command:kick':        {fn: kickCommand, description: 'Kick sombody from the channel'},
        'command:clear':       {fn: clearCommand, description: 'Clear all messages from this window'},
        'command:ctcp':        {fn: ctcpCommand, description: 'Send a CTCP command to somebody'},
        'command:quit':        {fn: quitCommand, description: 'Disconnect from the IRC server'},
        'command:server':      {fn: serverCommand, description: 'Conenct to a new IRC network'},
        'command:whois':       {fn: whoisCommand, description: 'Request information on somebody'},
        'command:whowas':      {fn: whowasCommand, description: 'Request information on somebody that disconnected recently'},
        'command:away':        {fn: awayCommand, description: 'Mark yourself as away'},
        'command:encoding':    {fn: encodingCommand, description: 'Change your connection encoding'},
        'command:channel':     channelCommand,
        'command:applet':      appletCommand,
        'command:settings':    {fn: settingsCommand, description: 'Show the settings window'},
        'command:script':      {fn: scriptCommand, description: 'Modify kiwi user scripts'}
    };


    fn_to_bind['command:css'] = {
        description: 'Reload the pages stylesheets',
        fn: function(ev) {
            var queryString = '?reload=' + new Date().getTime();
            $('link[rel="stylesheet"]').each(function () {
                this.href = this.href.replace(/\?.*|$/, queryString);
            });
        }
    };


    fn_to_bind['command:js'] = {
        descrption: 'Load a javascript file from a URL',
        fn: function(ev) {
            if (!ev.params[0]) return;
            $script(ev.params[0] + '?' + (new Date().getTime()));
        }
    };


    fn_to_bind['command:set'] = {
        descrption: 'Set a kiwi config setting',
        fn: function(ev) {
            if (!ev.params[0]) return;

            var setting = ev.params[0],
                value;

            // Do we have a second param to set a value?
            if (ev.params[1]) {
                ev.params.shift();

                value = ev.params.join(' ');

                // If we're setting a true boolean value..
                if (value === 'true')
                    value = true;

                // If we're setting a false boolean value..
                if (value === 'false')
                    value = false;

                // If we're setting a number..
                if (parseInt(value, 10).toString() === value)
                    value = parseInt(value, 10);

                _kiwi.global.settings.set(setting, value);
            }

            // Read the value to the user
            this.app.panels().active.addMsg('', utils.styleText('set_setting', {text: setting + ' = ' + _kiwi.global.settings.get(setting).toString()}));
        }
    };


    fn_to_bind['command:save'] = {
        descrption: 'Save the current kiwi settings',
        fn: function(ev) {
            _kiwi.global.settings.save();
            this.app.panels().active.addMsg('', utils.styleText('settings_saved', {text: utils.translateText('client_models_application_settings_saved')}));
        }
    };


    fn_to_bind['command:alias'] = {
        descrption: 'Create an alias to an existing /command',
        fn: function(ev) {
            var that = this,
                name, rule;

            // No parameters passed so list them
            if (!ev.params[1]) {
                $.each(this.controlbox.preprocessor.aliases, function (name, rule) {
                    that.app.panels().server.addMsg(' ', utils.styleText('list_aliases', {text: name + '   =>   ' + rule}));
                });
                return;
            }

            // Deleting an alias?
            if (ev.params[0] === 'del' || ev.params[0] === 'delete') {
                name = ev.params[1];
                if (name[0] !== '/') name = '/' + name;
                delete this.controlbox.preprocessor.aliases[name];
                return;
            }

            // Add the alias
            name = ev.params[0];
            ev.params.shift();
            rule = ev.params.join(' ');

            // Make sure the name starts with a slash
            if (name[0] !== '/') name = '/' + name;

            // Now actually add the alias
            this.controlbox.preprocessor.aliases[name] = rule;
        }
    };


    fn_to_bind['command:ignore'] = {
        descrption: 'Ignore messages from somebody',
        fn: function(ev) {
            var that = this,
                list = this.app.connections.active_connection.get('ignore_list'),
                user_mask;

            // No parameters passed so list them
            if (!ev.params[0]) {
                if (list.length > 0) {
                    this.app.panels().active.addMsg(' ', utils.styleText('ignore_title', {text: utils.translateText('client_models_application_ignore_title')}));
                    $.each(list, function (idx, ignored_pattern) {
                        that.app.panels().active.addMsg(' ', utils.styleText('ignored_pattern', {text: ignored_pattern[0]}));
                    });
                } else {
                    this.app.panels().active.addMsg(' ', utils.styleText('ignore_none', {text: utils.translateText('client_models_application_ignore_none')}));
                }
                return;
            }

            // We have a parameter, so add it, first convert it to regex.
            user_mask = utils.toUserMask(ev.params[0], true);
            list.push(user_mask);
            this.app.connections.active_connection.set('ignore_list', list);
            this.app.panels().active.addMsg(' ', utils.styleText('ignore_nick', {text: utils.translateText('client_models_application_ignore_nick', [user_mask[0]])}));
        }
    };


    fn_to_bind['command:unignore'] = {
        descrption: 'Stop ignoring somebody',
        fn: function(ev) {
            var list = this.app.connections.active_connection.get('ignore_list'),
                user_mask;

            if (!ev.params[0]) {
                this.app.panels().active.addMsg(' ', utils.styleText('ignore_stop_notice', {text: utils.translateText('client_models_application_ignore_stop_notice')}));
                return;
            }

            user_mask = utils.toUserMask(ev.params[0], true);
            list = _.reject(list, function(pattern) {
                return pattern[1].toString() === user_mask[1].toString();
            });

            this.app.connections.active_connection.set('ignore_list', list);

            this.app.panels().active.addMsg(' ', utils.styleText('ignore_stopped', {text: utils.translateText('client_models_application_ignore_stopped', [user_mask[0]])}));
        }
    };




    // A fallback action. Send a raw command to the server
    function unknownCommand (ev) {
        var raw_cmd = ev.command + ' ' + ev.params.join(' ');
        this.app.connections.active_connection.gateway.raw(raw_cmd);
    }


    function allCommands (ev) {}


    function joinCommand (ev) {
        var panels, channel_names;

        channel_names = ev.params.join(' ').split(',');
        panels = this.app.connections.active_connection.createAndJoinChannels(channel_names);

        // Show the last channel if we have one
        if (panels.length)
            panels[panels.length - 1].view.show();
    }


    function queryCommand (ev) {
        var destination, message, panel;

        destination = ev.params[0];
        ev.params.shift();

        message = ev.params.join(' ');

        // Check if we have the panel already. If not, create it
        panel = this.app.connections.active_connection.panels.getByName(destination);
        if (!panel) {
            panel = new (require('models/query'))({name: destination});
            this.app.connections.active_connection.panels.add(panel);
        }

        if (panel) panel.view.show();

        if (message) {
            this.app.connections.active_connection.gateway.msg(panel.get('name'), message);
            panel.addMsg(this.app.connections.active_connection.get('nick'), utils.styleText('privmsg', {text: message}), 'privmsg');
        }

    }


    function msgCommand (ev) {
        var message,
            destination = ev.params[0],
            panel = this.app.connections.active_connection.panels.getByName(destination) || this.app.panels().server;

        ev.params.shift();
        message = ev.params.join(' ');

        panel.addMsg(this.app.connections.active_connection.get('nick'), utils.styleText('privmsg', {text: message}), 'privmsg');
        this.app.connections.active_connection.gateway.msg(destination, message);
    }


    function actionCommand (ev) {
        if (this.app.panels().active.isServer()) {
            return;
        }

        var panel = this.app.panels().active;
        panel.addMsg('', utils.styleText('action', {nick: this.app.connections.active_connection.get('nick'), text: ev.params.join(' ')}), 'action');
        this.app.connections.active_connection.gateway.action(panel.get('name'), ev.params.join(' '));
    }


    function partCommand (ev) {
        var that = this,
            chans,
            msg;
        if (ev.params.length === 0) {
            this.app.connections.active_connection.gateway.part(this.app.panels().active.get('name'));
        } else {
            chans = ev.params[0].split(',');
            msg = ev.params[1];
            _.each(chans, function (channel) {
                that.connections.active_connection.gateway.part(channel, msg);
            });
        }
    }


    function cycleCommand (ev) {
        var that = this,
            chan_name;

        if (ev.params.length === 0) {
            chan_name = this.app.panels().active.get('name');
        } else {
            chan_name = ev.params[0];
        }

        this.app.connections.active_connection.gateway.part(chan_name);

        // Wait for a second to give the network time to register the part command
        setTimeout(function() {
            // Use createAndJoinChannels() here as it auto-creates panels instead of waiting for the network
            that.app.connections.active_connection.createAndJoinChannels(chan_name);
            that.app.connections.active_connection.panels.getByName(chan_name).show();
        }, 1000);
    }


    function nickCommand (ev) {
        this.app.connections.active_connection.gateway.changeNick(ev.params[0]);
    }


    function topicCommand (ev) {
        var channel_name;

        if (ev.params.length === 0) return;

        if (this.app.connections.active_connection.isChannelName(ev.params[0])) {
            channel_name = ev.params[0];
            ev.params.shift();
        } else {
            channel_name = this.app.panels().active.get('name');
        }

        this.app.connections.active_connection.gateway.topic(channel_name, ev.params.join(' '));
    }


    function noticeCommand (ev) {
        var destination;

        // Make sure we have a destination and some sort of message
        if (ev.params.length <= 1) return;

        destination = ev.params[0];
        ev.params.shift();

        this.app.connections.active_connection.gateway.notice(destination, ev.params.join(' '));
    }


    function quoteCommand (ev) {
        var raw = ev.params.join(' ');
        this.app.connections.active_connection.gateway.raw(raw);
    }


    function kickCommand (ev) {
        var nick, panel = this.app.panels().active;

        if (!panel.isChannel()) return;

        // Make sure we have a nick
        if (ev.params.length === 0) return;

        nick = ev.params[0];
        ev.params.shift();

        this.app.connections.active_connection.gateway.kick(panel.get('name'), nick, ev.params.join(' '));
    }


    function clearCommand (ev) {
        // Can't clear a server or applet panel
        if (this.app.panels().active.isServer() || this.app.panels().active.isApplet()) {
            return;
        }

        if (this.app.panels().active.clearMessages) {
            this.app.panels().active.clearMessages();
        }
    }


    function ctcpCommand(ev) {
        var target, type;

        // Make sure we have a target and a ctcp type (eg. version, time)
        if (ev.params.length < 2) return;

        target = ev.params[0];
        ev.params.shift();

        type = ev.params[0];
        ev.params.shift();

        this.app.connections.active_connection.gateway.ctcpRequest(type, target, ev.params.join(' '));
    }


    function settingsCommand (ev) {
        var settings = require('models/applet').loadOnce('kiwi_settings');
        settings.view.show();
    }


    function scriptCommand (ev) {
        var editor = require('models/applet').loadOnce('kiwi_script_editor');
        editor.view.show();
    }


    function appletCommand (ev) {
        if (!ev.params[0]) return;

        var panel = new (require('models/applet'))();

        if (ev.params[1]) {
            // Url and name given
            panel.load(ev.params[0], ev.params[1]);
        } else {
            // Load a pre-loaded applet
            if (this.applets[ev.params[0]]) {
                panel.load(new this.applets[ev.params[0]]());
            } else {
                this.app.panels().server.addMsg('', utils.styleText('applet_notfound', {text: utils.translateText('client_models_application_applet_notfound', [ev.params[0]])}));
                return;
            }
        }

        this.app.connections.active_connection.panels.add(panel);
        panel.view.show();
    }


    function inviteCommand (ev) {
        var nick, channel;

        // A nick must be specified
        if (!ev.params[0])
            return;

        // Can only invite into channels
        if (!this.app.panels().active.isChannel())
            return;

        nick = ev.params[0];
        channel = this.app.panels().active.get('name');

        this.app.connections.active_connection.gateway.raw('INVITE ' + nick + ' ' + channel);

        this.app.panels().active.addMsg('', utils.styleText('channel_has_been_invited', {nick: nick, text: utils.translateText('client_models_application_has_been_invited', [channel])}), 'action');
    }


    function whoisCommand (ev) {
        var nick;

        if (ev.params[0]) {
            nick = ev.params[0];
        } else if (this.app.panels().active.isQuery()) {
            nick = this.app.panels().active.get('name');
        }

        if (nick)
            this.app.connections.active_connection.gateway.raw('WHOIS ' + nick + ' ' + nick);
    }


    function whowasCommand (ev) {
        var nick;

        if (ev.params[0]) {
            nick = ev.params[0];
        } else if (this.app.panels().active.isQuery()) {
            nick = this.app.panels().active.get('name');
        }

        if (nick)
            this.app.connections.active_connection.gateway.raw('WHOWAS ' + nick);
    }


    function awayCommand (ev) {
        this.app.connections.active_connection.gateway.raw('AWAY :' + ev.params.join(' '));
    }


    function encodingCommand (ev) {
        var that = this;

        if (ev.params[0]) {
            _kiwi.gateway.setEncoding(null, ev.params[0], function (success) {
                if (success) {
                    that.app.panels().active.addMsg('', utils.styleText('encoding_changed', {text: utils.translateText('client_models_application_encoding_changed', [ev.params[0]])}));
                } else {
                    that.app.panels().active.addMsg('', utils.styleText('encoding_invalid', {text: utils.translateText('client_models_application_encoding_invalid', [ev.params[0]])}));
                }
            });
        } else {
            this.app.panels().active.addMsg('', utils.styleText('client_models_application_encoding_notspecified', {text: utils.translateText('client_models_application_encoding_notspecified')}));
            this.app.panels().active.addMsg('', utils.styleText('client_models_application_encoding_usage', {text: utils.translateText('client_models_application_encoding_usage')}));
        }
    }


    function channelCommand (ev) {
        var active_panel = this.app.panels().active;

        if (!active_panel.isChannel())
            return;

        new (require('models/channelinfo'))({channel: this.app.panels().active});
    }


    function quitCommand (ev) {
        var network = this.app.connections.active_connection;

        if (!network)
            return;

        network.gateway.quit(ev.params.join(' '));
    }


    function serverCommand (ev) {
        var that = this,
            server, port, ssl, password, nick,
            tmp;

        // If no server address given, show the new connection dialog
        if (!ev.params[0]) {
            tmp = new (require('views/menubox'))(_kiwi.global.i18n.translate('client_models_application_connection_create').fetch());
            tmp.addItem('new_connection', new (require('models/newconnection'))().view.$el);
            tmp.show();

            // Center screen the dialog
            tmp.$el.offset({
                top: (this.app.view.$el.height() / 2) - (tmp.$el.height() / 2),
                left: (this.app.view.$el.width() / 2) - (tmp.$el.width() / 2)
            });

            return;
        }

        // Port given in 'host:port' format and no specific port given after a space
        if (ev.params[0].indexOf(':') > 0) {
            tmp = ev.params[0].split(':');
            server = tmp[0];
            port = tmp[1];

            password = ev.params[1] || undefined;

        } else {
            // Server + port given as 'host port'
            server = ev.params[0];
            port = ev.params[1] || 6667;

            password = ev.params[2] || undefined;
        }

        // + in the port means SSL
        if (port.toString()[0] === '+') {
            ssl = true;
            port = parseInt(port.substring(1), 10);
        } else {
            ssl = false;
        }

        // Default port if one wasn't found
        port = port || 6667;

        // Use the same nick as we currently have
        nick = this.app.connections.active_connection.get('nick');

        this.app.panels().active.addMsg('', utils.styleText('server_connecting', {text: utils.translateText('client_models_application_connection_connecting', [server, port.toString()])}));

        _kiwi.gateway.newConnection({
            nick: nick,
            host: server,
            port: port,
            ssl: ssl,
            password: password
        }, function(err, new_connection) {
            var translated_err;

            if (err) {
                translated_err = utils.translateText('client_models_application_connection_error', [server, port.toString(), err.toString()]);
                that.app.panels().active.addMsg('', utils.styleText('server_connecting_error', {text: translated_err}));
            }
        });
    }

});
