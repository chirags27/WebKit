/*
 * Copyright (C) 2020 Apple Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS ``AS IS''
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
 * THE POSSIBILITY OF SUCH DAMAGE.
 */

// @internal

function isTransformStream(stream)
{
    "use strict";

    return @isObject(stream) && !!@getByIdDirectPrivate(stream, "internalReadable");
}

function isTransformStreamDefaultController(controller)
{
    "use strict";

    return @isObject(controller) && !!@getByIdDirectPrivate(controller, "transformAlgorithm");
}

function createInternalTransformStreamFromTransformer(transformer, writableStrategy, readableStrategy)
{
    if (transformer === @undefined)
        transformer = null;

    if (readableStrategy === @undefined)
        readableStrategy = { };

    if (writableStrategy === @undefined)
        writableStrategy = { };

    let transformerDict = { };
    if (transformer !== null) {
        if ("start" in transformer) {
            transformerDict["start"] = transformer["start"];
            if (typeof transformerDict["start"] !== "function")
                @throwTypeError("transformer.start should be a function");
        }
        if ("transform" in transformer) {
            transformerDict["transform"] = transformer["transform"];
            if (typeof transformerDict["transform"] !== "function")
                @throwTypeError("transformer.transform should be a function");
        }
        if ("flush" in transformer) {
            transformerDict["flush"] = transformer["flush"];
            if (typeof transformerDict["flush"] !== "function")
                @throwTypeError("transformer.flush should be a function");
        }

        if ("readableType" in transformer)
            @throwRangeError("TransformStream transformer has a readableType");
        if ("writableType" in transformer)
            @throwRangeError("TransformStream transformer has a writableType");
    }

    const readableHighWaterMark = @extractHighWaterMark(readableStrategy, 0);
    const readableSizeAlgorithm = @extractSizeAlgorithm(readableStrategy);

    const writableHighWaterMark = @extractHighWaterMark(writableStrategy, 1);
    const writableSizeAlgorithm = @extractSizeAlgorithm(writableStrategy);

    const internalTransformStream = {};
    const startPromiseCapability = @newPromiseCapability(@Promise);
    const [readable, writable] = @initializeTransformStream(internalTransformStream, startPromiseCapability.@promise, writableHighWaterMark, writableSizeAlgorithm, readableHighWaterMark, readableSizeAlgorithm);
    @setUpTransformStreamDefaultControllerFromTransformer(internalTransformStream, transformer, transformerDict);

    if ("start" in transformerDict) {
        const controller = @getByIdDirectPrivate(internalTransformStream, "controller");
        const startAlgorithm = () => @promiseInvokeOrNoopMethodNoCatch(transformer, transformerDict["start"], [controller]);
        startAlgorithm().@then(() => {
            // FIXME: We probably need to resolve start promise with the result of the start algorithm.
            startPromiseCapability.@resolve.@call();
        }, (error) => {
            startPromiseCapability.@reject.@call(@undefined, error);
        });
    } else
        startPromiseCapability.@resolve.@call();

    return [internalTransformStream, readable, writable];
}

function createTransformStream(startAlgorithm, transformAlgorithm, flushAlgorithm, writableHighWaterMark, writableSizeAlgorithm, readableHighWaterMark, readableSizeAlgorithm)
{
    if (writableHighWaterMark === @undefined)
        writableHighWaterMark = 1;
    if (writableSizeAlgorithm === @undefined)
        writableSizeAlgorithm = () => 1;
    if (readableHighWaterMark === @undefined)
        readableHighWaterMark = 0;
    if (readableSizeAlgorithm === @undefined)
        readableSizeAlgorithm = () => 1;
    @assert(writableHighWaterMark >= 0);
    @assert(readableHighWaterMark >= 0);

    const stream = {};
    const startPromiseCapability = @newPromiseCapability(@Promise);
    const [readable, writable] = @initializeTransformStream(stream, startPromiseCapability.@promise, writableHighWaterMark, writableSizeAlgorithm, readableHighWaterMark, readableSizeAlgorithm);

    const controller = new @TransformStreamDefaultController(@isTransformStream);
    @setUpTransformStreamDefaultController(stream, controller, transformAlgorithm, flushAlgorithm);

    startAlgorithm().@then(() => {
        startPromiseCapability.@resolve.@call();
    }, (error) => {
        startPromiseCapability.@reject.@call(@undefined, error);
    });

    return [stream, readable, writable];
}

function initializeTransformStream(stream, startPromise, writableHighWaterMark, writableSizeAlgorithm, readableHighWaterMark, readableSizeAlgorithm)
{
    "use strict";

    const startAlgorithm = () => { return startPromise; };
    const writeAlgorithm = (chunk) => { return @transformStreamDefaultSinkWriteAlgorithm(stream, chunk); }
    const abortAlgorithm = (reason) => { return @transformStreamDefaultSinkAbortAlgorithm(stream, reason); }
    const closeAlgorithm = () => { return @transformStreamDefaultSinkCloseAlgorithm(stream); }
    const writable = @createWritableStream(startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, writableHighWaterMark, writableSizeAlgorithm);

    const pullAlgorithm = () => { return @transformStreamDefaultSourcePullAlgorithm(stream); };
    const cancelAlgorithm = (reason) => {
        @transformStreamErrorWritableAndUnblockWrite(stream, reason);
        return @Promise.@resolve();
    };
    const underlyingSource = { };
    @putByIdDirectPrivate(underlyingSource, "start", startAlgorithm);
    @putByIdDirectPrivate(underlyingSource, "pull", pullAlgorithm);
    @putByIdDirectPrivate(underlyingSource, "cancel", cancelAlgorithm);
    const options = { };
    @putByIdDirectPrivate(options, "size", readableSizeAlgorithm);
    @putByIdDirectPrivate(options, "highWaterMark", readableHighWaterMark);
    const readable = new @ReadableStream(underlyingSource, options);

    // The writable to use for the actual transform algorithms.
    @putByIdDirectPrivate(stream, "internalWritable", @getInternalWritableStream(writable));

    // The readable to use for the actual transform algorithms.
    @putByIdDirectPrivate(stream, "internalReadable", @getInternalReadableStream(readable));

    @putByIdDirectPrivate(stream, "backpressure", @undefined);
    @putByIdDirectPrivate(stream, "backpressureChangePromise", @undefined);

    @transformStreamSetBackpressure(stream, true);
    @putByIdDirectPrivate(stream, "controller", @undefined);

    return [readable, writable];
}

function transformStreamError(stream, e)
{
    "use strict";

    const readable = @getByIdDirectPrivate(stream, "internalReadable");
    @assert(!!readable);
    const readableController = @getByIdDirectPrivate(readable, "readableStreamController");
    @readableStreamDefaultControllerError(readableController, e);

    @transformStreamErrorWritableAndUnblockWrite(stream, e);
}

function transformStreamErrorWritableAndUnblockWrite(stream, e)
{
    "use strict";

    @transformStreamDefaultControllerClearAlgorithms(@getByIdDirectPrivate(stream, "controller"));

    const writable = @getByIdDirectPrivate(stream, "internalWritable");
    @writableStreamDefaultControllerErrorIfNeeded(@getByIdDirectPrivate(writable, "controller"), e);

    if (@getByIdDirectPrivate(stream, "backpressure"))
        @transformStreamSetBackpressure(stream, false);
}

function transformStreamSetBackpressure(stream, backpressure)
{
    "use strict";

    @assert(@getByIdDirectPrivate(stream, "backpressure") !== backpressure);

    const backpressureChangePromise = @getByIdDirectPrivate(stream, "backpressureChangePromise");
    if (backpressureChangePromise !== @undefined)
        backpressureChangePromise.@resolve.@call();

    @putByIdDirectPrivate(stream, "backpressureChangePromise", @newPromiseCapability(@Promise));
    @putByIdDirectPrivate(stream, "backpressure", backpressure);
}

function setUpTransformStreamDefaultController(stream, controller, transformAlgorithm, flushAlgorithm)
{
    "use strict";

    @assert(@isTransformStream(stream));
    @assert(@getByIdDirectPrivate(stream, "controller") === @undefined);

    @putByIdDirectPrivate(controller, "stream", stream);
    @putByIdDirectPrivate(stream, "controller", controller);
    @putByIdDirectPrivate(controller, "transformAlgorithm", transformAlgorithm);
    @putByIdDirectPrivate(controller, "flushAlgorithm", flushAlgorithm);
}


function setUpTransformStreamDefaultControllerFromTransformer(stream, transformer, transformerDict)
{
    "use strict";

    const controller = new @TransformStreamDefaultController(@isTransformStream);
    let transformAlgorithm = (chunk) => {
        try {
            @transformStreamDefaultControllerEnqueue(controller, chunk);
        } catch (e) {
            return @Promise.@reject(e);
        }
        return @Promise.@resolve();
    };
    let flushAlgorithm = () => { return @Promise.@resolve(); };

    if ("transform" in transformerDict)
        transformAlgorithm = (chunk) => {
            return @promiseInvokeOrNoopMethod(transformer, transformerDict["transform"], [chunk, controller]);
        };

    if ("flush" in transformerDict) {
        flushAlgorithm = () => {
            return @promiseInvokeOrNoopMethod(transformer, transformerDict["flush"], [controller]);
        };
    }

    @setUpTransformStreamDefaultController(stream, controller, transformAlgorithm, flushAlgorithm);
}

function transformStreamDefaultControllerClearAlgorithms(controller)
{
    "use strict";

    // We set transformAlgorithm to true to allow GC but keep the isTransformStreamDefaultController check.
    @putByIdDirectPrivate(controller, "transformAlgorithm", true);
    @putByIdDirectPrivate(controller, "flushAlgorithm", @undefined);
}

function transformStreamDefaultControllerEnqueue(controller, chunk)
{
    "use strict";

    const stream = @getByIdDirectPrivate(controller, "stream");
    const readable = @getByIdDirectPrivate(stream, "internalReadable");
    const readableController = @getByIdDirectPrivate(readable, "readableStreamController");

    @assert(readableController !== @undefined);
    if (!@readableStreamDefaultControllerCanCloseOrEnqueue(readableController))
        @throwTypeError("TransformStream.readable cannot close or enqueue");

    try {
        @readableStreamDefaultControllerEnqueue(readableController, chunk);
    } catch (e) {
        @transformStreamErrorWritableAndUnblockWrite(stream, e);
        throw @getByIdDirectPrivate(readable, "storedError");
    }

    const backpressure = !@readableStreamDefaultControllerShouldCallPull(readableController);
    if (backpressure !== @getByIdDirectPrivate(stream, "backpressure")) {
        @assert(backpressure);
        @transformStreamSetBackpressure(stream, true);
    }
}

function transformStreamDefaultControllerError(controller, e)
{
    "use strict";

    @transformStreamError(@getByIdDirectPrivate(controller, "stream"), e);
}

function transformStreamDefaultControllerPerformTransform(controller, chunk)
{
    "use strict";

    const promiseCapability = @newPromiseCapability(@Promise);

    const transformPromise = @getByIdDirectPrivate(controller, "transformAlgorithm").@call(@undefined, chunk);
    transformPromise.@then(() => {
        promiseCapability.@resolve();
    }, (r) => {
        @transformStreamError(@getByIdDirectPrivate(controller, "stream"), r);
        promiseCapability.@reject.@call(@undefined, r);
    });
    return promiseCapability.@promise;
}

function transformStreamDefaultControllerTerminate(controller)
{
    "use strict";

    const stream = @getByIdDirectPrivate(controller, "stream");
    const readable = @getByIdDirectPrivate(stream, "internalReadable");
    @assert(!!readable);
    const readableController = @getByIdDirectPrivate(readable, "readableStreamController");

    // FIXME: Update readableStreamDefaultControllerClose to make this check.
    if (@readableStreamDefaultControllerCanCloseOrEnqueue(readableController))
        @readableStreamDefaultControllerClose(readableController);
    const error = @makeTypeError("the stream has been terminated");
    @transformStreamErrorWritableAndUnblockWrite(stream, error);
}

function transformStreamDefaultSinkWriteAlgorithm(stream, chunk)
{
    "use strict";

    const writable = @getByIdDirectPrivate(stream, "internalWritable");

    @assert(@getByIdDirectPrivate(writable, "state") === "writable");

    const controller = @getByIdDirectPrivate(stream, "controller");

    if (@getByIdDirectPrivate(stream, "backpressure")) {
        const promiseCapability = @newPromiseCapability(@Promise);

        const backpressureChangePromise = @getByIdDirectPrivate(stream, "backpressureChangePromise");
        @assert(backpressureChangePromise !== @undefined);
        backpressureChangePromise.@promise.@then(() => {
            const state = @getByIdDirectPrivate(writable, "state");
            if (state === "erroring") {
                promiseCapability.@reject.@call(@undefined, @getByIdDirectPrivate(writable, "storedError"));
                return;
            }

            @assert(state === "writable");
            @transformStreamDefaultControllerPerformTransform(controller, chunk).@then(() => {
                promiseCapability.@resolve();
            }, (e) => {
                promiseCapability.@reject.@call(@undefined, e);
            });
        }, (e) => {
            promiseCapability.@reject.@call(@undefined, e);
        });

        return promiseCapability.@promise;
    }
    return @transformStreamDefaultControllerPerformTransform(controller, chunk);
}

function transformStreamDefaultSinkAbortAlgorithm(stream, reason)
{
    "use strict";

    @transformStreamError(stream, reason);
    return @Promise.@resolve();
}

function transformStreamDefaultSinkCloseAlgorithm(stream)
{
    "use strict";
    const readable = @getByIdDirectPrivate(stream, "internalReadable");
    @assert(!!readable);
    const controller = @getByIdDirectPrivate(stream, "controller");
    const readableController = @getByIdDirectPrivate(readable, "readableStreamController");

    const flushAlgorithm = @getByIdDirectPrivate(controller, "flushAlgorithm");
    @assert(flushAlgorithm !== @undefined);
    const flushPromise = @getByIdDirectPrivate(controller, "flushAlgorithm").@call();
    @transformStreamDefaultControllerClearAlgorithms(controller);

    const promiseCapability = @newPromiseCapability(@Promise);
    flushPromise.@then(() => {
        if (@getByIdDirectPrivate(readable, "state") === @streamErrored) {
            promiseCapability.@reject.@call(@undefined, @getByIdDirectPrivate(readable, "storedError"));
            return;
        }

        // FIXME: Update readableStreamDefaultControllerClose to make this check.
        if (@readableStreamDefaultControllerCanCloseOrEnqueue(readableController))
            @readableStreamDefaultControllerClose(readableController);
        promiseCapability.@resolve();
    }, (r) => {
        @transformStreamError(@getByIdDirectPrivate(controller, "stream"), r);
        promiseCapability.@reject.@call(@undefined, @getByIdDirectPrivate(readable, "storedError"));
    });
    return promiseCapability.@promise;
}

function transformStreamDefaultSourcePullAlgorithm(stream)
{
    "use strict";

    @assert(@getByIdDirectPrivate(stream, "backpressure"));
    @assert(@getByIdDirectPrivate(stream, "backpressureChangePromise") !== @undefined);

    @transformStreamSetBackpressure(stream, false);

    return @getByIdDirectPrivate(stream, "backpressureChangePromise").@promise;
}
