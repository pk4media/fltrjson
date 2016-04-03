'use strict';
let moment = require('moment');
require('./modules/any');

class fltr {
    constructor (query) {
        this.query = query || {};
        this.parallizedQueries = this._generateParallizedQueries(this.query);
    }

    _generateParallizedQueries (query) {
        let queries = [];
        for (let path in query) {
            queries.push({
                path: path.split('.'),
                result: query[path]
            });
        }
        return queries;
    }

    match (object) {
        let queries = this.parallizedQueries.map((query)=> {
            return Promise.resolve()
                .then(()=> this._deepSearchObject(query.path, object))
                .then((value)=> this._compareValues(query.result, value))
        });
        return Promise.all(queries);
    }

    _deepSearchObject (path, object) {
        let attribute = path[0],
            nextPath = path.slice(1);

        if (attribute === undefined) {
            return Promise.resolve(object);
        }

        if (Array.isArray(object)) {
            if (/\*/.test(attribute)) {
                let arrayChecks = object.map((arrayObject)=> this._deepSearchObject(nextPath, arrayObject));
                return Promise.any(arrayChecks);
            }

            if (/\d+/.test(attribute)) {
                let index = parseInt(attribute, 10);
                if (object.length > index) {
                    return this._deepSearchObject(nextPath, object[index]);
                } else {
                    return Promise.reject(new Error('Index out of bound!'));
                }
            }

            return Promise.reject(new Error(`No valid Array Index is given!`));
        }

        if (typeof object === 'object' && attribute in object) {
            return this._deepSearchObject(nextPath, object[attribute]);
        }

        return Promise.reject(new Error(`Object ${object[attribute]} not found!`));
    }

    _compareValues (result, value) {
        if (typeof result === typeof value && Array.isArray(result) === Array.isArray(value)) {
            return this.__equals(result, value);
        }

        if (typeof result === 'function') {
            return this.__function(result, value);
        }

        if (typeof result === 'object' && !Array.isArray(result) && result.$not) {
            return this.__not(result.$not, value);
        }

        if (typeof result === 'object' && !Array.isArray(result) && result.$or) {
            return this.__or(result.$or, value)
        }

        switch (typeof value) {
            case 'number':
                return this._compareNumbers(result, value);
            case 'string':
                return this._compareStrings(result, value);
            case 'boolean':
                return this._compareBools(result, value);
            case 'object':
                if (Array.isArray(value)) {
                    return this._compareArray(result, value);
                } else {
                    return Promise.reject(new Error('no valid attribute'));
                }
            default:
                return Promise.reject(new Error('no valid attribute'));
        }
    }

    _compareArray (result, array) {
        if (result.$contains) {
            return this.__in(array, result.$contains);
        }
        return Promise.reject(new Error(`Unknown Operator: ${result}`));
    }

    _compareNumbers (result, value) {
        if (result.$after || result.$before || result.$date) {
            return this._compareDate(result, value);
        }

        if (result.$eq) {
            return this.__equals(result.$eq, value);
        }

        if (result.$in) {
            return this.__in(result.$in, value);
        }

        //check lower boundaries
        if ((result.$gte && value < result.$gte) || (result.$gt && value <= result.$gt)) {
            return Promise.reject(new Error('Below lower Boundary Error!'));
        }

        //check upper boundaries
        if ((result.$lte && value > result.$lte) || (result.$lt && value >= result.$lt)) {
            return Promise.reject(new Error('Above upper Boundary Error!'));
        }

        return Promise.resolve();
    };

    _compareDate (result, date) {
        moment.locale(process.env.LANG);

        if (typeof date === 'number') {
            date = moment(date);
        } else if (result.$format && typeof result.$format === 'string') {
            date = moment(date, result.$format);
        } else {
            date = moment(date, 'L LTS');
        }

        if (result.$after) {
            let afterDate = null,
                after = result.$after,
                type = typeof after;

            if (type === 'string'){
                afterDate = moment(after, 'L LTS');
            } else if (type === 'number') {
                afterDate = moment(after);
            } else if (type === 'object' && !Array.isArray(after)) {
                if (after.date && typeof after.date === 'string') {
                    if (after.format && typeof after.format === 'string') {
                        afterDate = moment(after, after.format);
                    } else {
                        afterDate = moment(after.date, 'L LTS');
                    }
                } else {
                    return Promise.reject(new Error('No Date to parse'))
                }
            } else {
                return Promise.reject(new Error('Invalid Matchobject'));
            }

            if (!date.isAfter(afterDate)) {
                return Promise.reject(new Error('Date is NOT after $after!'))
            }
        }

        if (result.$before) {
            let beforeDate = null,
                before = result.$before,
                type = typeof before;

            if (type === 'string'){
                beforeDate = moment(before, 'L LTS');
            } else if (type === 'number') {
                beforeDate = moment(before);
            } else if (type === 'object' && !Array.isArray(before)) {
                if (before.date && typeof before.date === 'string') {
                    if (before.format && typeof before.format === 'string') {
                        beforeDate = moment(before, before.format);
                    } else {
                        beforeDate = moment(before.date, 'L LTS');
                    }
                } else {
                    return Promise.reject(new Error('No Date to parse'))
                }
            } else {
                return Promise.reject(new Error('Invalid Matchobject'));
            }

            if (!date.isBefore(beforeDate)) {
                return Promise.reject(new Error('Date is NOT before $before!'))
            }
        }

        return Promise.reject(new Error(`Unknown Operator: ${result}`));
    }

    _compareBools (result, bool) {
        if (bool === !!result) {
            return Promise.resolve();
        } else {
            return Promise.reject(new Error('Boolean Values do not match!'));
        }
    }

    _compareStrings (result, word) {
        if (result.$after || result.$before || result.$date) {
            return this._compareDate(result, word);
        }

        if (result.$regexp) {
            try{
                let regexp = new RegExp(result.$regexp, 'gm');
                if (regexp.test(word)) {
                    return Promise.resolve();
                } else {
                    return Promise.reject(new Error('RegExp did not match!'))
                }
            } catch (error) {
                return Promise.reject(error);
            }
        }

        return Promise.reject(new Error(`Unknown Operator: ${result}`));
    }

    __function (func, value) {
        if (func(value)) {
            return Promise.resolve();
        } else {
            return Promise.reject(new Error(`Calculation mismatch!`));
        }
    }

    __equals (result, value) {
        if (result === value) {
            return Promise.resolve();
        } else {
            return Promise.reject(new Error(`Values do not match: ${result} !== ${value}`));
        }
    }

    __in (array, value) {
        let found = array.reduce((prev, cur)=> (prev || (cur === value)), false);
        if (found) {
            return Promise.resolve();
        } else  {
            return Promise.reject(new Error(`${value} not found in ${array}!`));
        }
    }

    __not (result, value) {
        return Promise.resolve()
            .then(()=> this._compareValues(result, value))
            .then(()=> Promise.reject(new Error(`negation of ${value} did not work`)), ()=> Promise.resolve());
    }

    __or (result, value) {
        if (typeof result === 'object' && !Array.isArray(result)) {
            let valueCompares = [];

            for (let comparison in result) {
                let res = {};
                    res[comparison] = result[comparison];
                valueCompares.push(this._compareValues(res, value));
            }
            return Promise.any(valueCompares);
        }
        return Promise.reject(new Error(`$or is now valid JSON Object!`));
    }
}

module.exports = fltr;