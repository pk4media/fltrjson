'use strict';

Promise.any = (arrayOfPromises)=> {
    var resolvingPromises = arrayOfPromises.map((promise)=> promise.then((result)=> ({
            resolve: true,
            result: result
        }), (error)=> ({
        resolve: false,
        result: error
    })));

    return Promise.all(resolvingPromises).then((results)=> {
        let passed = results.filter((result)=> result.resolve).map((result)=> result.result),
            failed = results.filter((result)=> !result.resolve).map((result)=> result.result);

        if (passed.length === 0) {
            return Promise.reject(failed);
        } else {
            return Promise.resolve(passed);
        }
    });
};