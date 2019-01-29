import assert from "assert";
import simple from "simple-mock";
import * as _ from "lodash";
import { Orca } from "../src/orca";
import "mocha";

describe("Orca", () => {
  let app, callbackOne, callbackTwo;

  before(() => {
    app = new Orca();
  });

  beforeEach(() => {
    app.reset();
    callbackOne = simple.spy(() => {});
    callbackTwo = simple.spy(() => {});
  });

  // Constructor Tests
  // ======================================================
  describe("#constructor", () => {
    it("should instantiate with custom args", () => {
      let app2 = new Orca({ globalKey: "**", entryKey: "__custom" });

      assert.equal("**", app2._globalKey);
      assert.equal("__custom", app2._entryKey);
    });
  });

  // Registration Tests
  // ======================================================
  describe("#registerAction", () => {
    let callbacks;

    it("should register actions", () => {
      let key = "foo";
      app.registerAction(key, callbackOne);
      callbacks = _.flattenDeep(app._callbacks[key][app._entryKey]);
      assert.ok(_.some(callbacks, ["func", callbackOne]));
    });

    it("should register global actions", () => {
      app.registerGlobalAction(callbackOne);
      callbacks = _.flattenDeep(app._callbacks[app._globalKey][app._entryKey]);
      assert.ok(_.some(callbacks, ["func", callbackOne]));
    });

    it("should register nested actions", () => {
      let nestedKey = "foo.bar";
      app.registerAction(nestedKey, callbackOne);
      callbacks = _.flattenDeep(app._callbacks["foo"]["bar"][app._entryKey]);
      assert.ok(_.some(callbacks, ["func", callbackOne]));
    });

    it("should register actions with priority", () => {
      app.registerGlobalAction(callbackOne, { priority: 99 });
      app.registerGlobalAction(callbackTwo, { priority: 100 });

      callbacks = _.flattenDeep(
        app._callbacks[app._globalKey][app._entryKey][99]
      );

      assert.ok(_.some(callbacks, ["func", callbackOne]));
      assert.equal(false, _.some(callbacks, ["func", callbackTwo]));
    });

    it("should reset", () => {
      app.registerGlobalAction(callbackOne);
      callbacks = _.flattenDeep(app._callbacks[app._globalKey][app._entryKey]);
      assert.ok(_.some(callbacks, ["func", callbackOne]));

      app.reset();
      assert.ok(_.isEmpty(app._callbacks));
    });

    it("should not allow registering invalid callbacks", () => {
      assert.throws(
        () => app.registerGlobalAction("not a callback"),
        TypeError
      );
      assert.throws(
        () => app.registerAction(app._entryKey, callbackOne),
        Error
      );
    });
  });

  // Run Tests
  // ======================================================
  describe("#run", () => {
    it("should run all callbacks in the global scope", () => {
      app.registerGlobalAction(callbackOne);
      app.run(app._globalKey);

      assert.equal(1, callbackOne.callCount);
    });

    it("should only run globals once when calling global scope", () => {
      app.registerGlobalAction(callbackOne);
      app.run();

      assert.equal(1, callbackOne.callCount);
    });

    it("should skip globals when running without globals", () => {
      app.registerGlobalAction(callbackOne);
      app.run("foo", { runGlobals: false });
      assert.equal(0, callbackOne.callCount);
    });

    it("should not run callbacks in excluded scopes", () => {
      app.registerGlobalAction(callbackOne, { excludes: ["foo"] });

      // Runs in global scope
      app.run();
      assert.equal(1, callbackOne.callCount);

      // Does not run in foo scope
      app.run("foo");
      assert.equal(1, callbackOne.callCount);

      // Does not run when passed an array of scopes
      app.registerAction("bar", callbackTwo);
      app.run(["foo", "bar"]);
      assert.equal(1, callbackOne.callCount);
      assert.equal(1, callbackTwo.callCount);
    });

    it("should not run excluded callbacks when running nested scopes", () => {
      app.registerGlobalAction(callbackOne, { excludes: ["foo.bar"] });
      app.registerAction("foo.bar", callbackTwo);
      app.registerAction("foo.bar.baz", callbackTwo);

      app.run("foo.bar");

      assert.equal(0, callbackOne.callCount);
      assert.equal(2, callbackTwo.callCount);
    });

    it("should allow excludes as a string", () => {
      app.registerGlobalAction(callbackOne, { excludes: "foo" });
      app.run("foo");
      assert.equal(0, callbackOne.callCount);
    });

    it("should only run callbacks in namespace", () => {
      app.registerAction("foo", callbackOne);
      app.registerAction("bar", callbackTwo);

      app.run("foo");

      assert.equal(1, callbackOne.callCount);
      assert.equal(0, callbackTwo.callCount);
    });

    it("should run all nested callbacks in namespace", () => {
      app.registerAction("foo", callbackOne);
      app.registerAction("foo.baz", callbackTwo);

      app.run("foo");

      assert.equal(1, callbackOne.callCount);
      assert.equal(1, callbackTwo.callCount);
    });

    it("should only run the deepest part of a namespace", () => {
      app.registerAction("foo", callbackOne);
      app.registerAction("foo.baz", callbackTwo);

      app.run("foo.baz");

      assert.equal(0, callbackOne.callCount);
      assert.equal(1, callbackTwo.callCount);
    });

    it("should always run global callbacks", () => {
      app.registerGlobalAction(callbackOne);
      app.registerAction("foo", callbackTwo);

      app.run("foo");

      assert.equal(1, callbackOne.callCount);
      assert.equal(1, callbackTwo.callCount);
    });

    it("should call higher priority callbacks first", () => {
      app.registerGlobalAction(callbackOne, { priority: 10 });
      app.registerGlobalAction(callbackTwo, { priority: 20 });

      app.run();

      assert.ok(callbackOne.lastCall.k > callbackTwo.lastCall.k);
    });
  });
});
