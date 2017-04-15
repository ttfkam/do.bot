const handler = {
    'commands': {},

    'add': function(command, callback, help, force = false){
        if(command in this.commands && !force){
            //TODO: throw error that will stop node
        }

        this.commands[command] = {
            'callback': callback,
            'help': help
        };

        console.info(`\tCommand: ${command} (${help}) has been loaded`);

        return this;
    },

    'fire': function(command, request, response){
        if(!(command in this.commands)){
              response.status(404);
              response.send('The command: {} is not registed with do.bot.');
        }

        console.info(`\tRunning command: ${command}`);

        return this.commands[command]['callback'](request, response);
    }
};

/**
 * Simple argument parser for commands. It will accept commands bound to
 * strings and commands that will be executed based on the number of arguments.
 * This is done when none of the string commands can be matched and it
 * determines the closest number of arguments that are less than or equal to
 * what has been defined.
 *
 * example slack ussage:
 *      /somecommand $argument $input
 *
 * developer usage:
 *      var commands = {
 *          'help': function(input, request, response){},
 *          'list': function(input, request, response){},
 *          1: function(input, request, response){},
 *          2: function(input_one, input_two, request, response){}
 *      };
 *
 *      var some_command = new StringArgumentParser(commands);
 *      command.handler.add('somecommand', some_command);
 *
 * @see NumberArgumentParser
 * @param commands ObjectLiteral<String|Int:Function>
 * @return function(request, response){}
 */
function StringArgumentParser(commands){
    var num_commands = {},
        final_commands = {};

    for(var command in commands){
        if(commands.hasOwnProperty(command)){
            const num_command = parseInt(command, 10);

            if(typeof num_command === 'number' && num_command >= 0){
                num_commands[num_command] = commands[command];
            }else{
                final_commands[command] = commands[command];
            }
        }
    }

    /**
     * Matching works by first sorting the commands by length in descending
     * order. A list of regular expressions is created that will attempt to
     * match the command starting with the longest command first. A match is
     * done from the beginning of the string only (this is why longest is first)
     *
     * given the example commands:
     *      command = {
     *          'help' : function(){},
     *          'help more' function(){}
     *      }
     *
     * a request body containing "help more here" would match the "help more"
     * command. while a body of "before help" would not match anything
     */
    var num_parser = new NumberArgumentParser(num_commands),
        defined_commands = Object.keys(final_commands).sort(function(a, b){
            return a.length - b.length || a.localeCompare(b);
        }).reverse(),
        search_commands = defined_commands.map(function(command){
            var reg = new RegExp(`^${command}`);
            reg.command = command;
            return reg
        });

    /**
     * parse the defined commands, if a match isnt found try parsing the
     * using NumberArgumentParser. That will return a 400 if nothing is matched
     */
    return function(request, response){
        const text = request.body.text;

        for(let i = 0, l = search_commands.length; i < l; i++){
            let regex = search_commands[i];

            if(text.match(regex)){
                const input = text.replace(regex, '');

                return final_commands[regex.command](input, request, response);
            }
        };

        return num_parser(request, response);
    };
};


/**
 * A way to define commands based on the number of space-separated arguments
 * that are passed into it. If the exact number isn't matched, it will
 * execute the next lowest number in the command stack.
 *
 * example slack ussage:
 *      /somecommand $argument $input
 *
 * developer usage:
 *      var commands = {
 *          1: function(input, request, response){},
 *          2: function(input_one, input_two, request, response){}
 *      };
 *
 *      var some_command = new NumberArgumentParser(commands);
 *      command.handler.add('somecommand', some_command);
 *
 * from slack:
 *      /somecommand one two three four
 *
 * result:
 *      based on the commands defined above, 2 would be matched. input_one
 *      would be set to 'one' while input_two would be 'two three four'
 *
 * @param commands ObjectLiteral<Int:Function>
 * @return function(request, response){}
 */
function NumberArgumentParser(commands){
    commands = commands || {};
    const nums_registered = Object.keys(commands).reverse().map(function(n){
        return parseInt(n, 10);
    });

    return function(request, response){
        const parts = request.body.text.split(' '),
            command_number = parts.length;

        for(let i = 0, l = nums_registered.length; i < l; i++){
            const num_command = nums_registered[i];

            if(num_command <= command_number){
                var args = [];

                for(let x = 0; x < num_command - 1; x++){
                    args.push(parts.shift());
                }

                var remainder = parts.join(' '),
                    args = args.concat([remainder, request, response]);

                return commands[num_command].apply(undefined, args)
            }
        };

        return response.status(400);
    };
};


const controller = {
    'post': function(request, response){
        const command = request.params.command;

        handler.fire(command, request, response);
    }
};

module.exports = {
    'controller': controller,
    'handler': handler,
    'StringArgumentParser': StringArgumentParser,
    'NumberArgumentParser': NumberArgumentParser
};
