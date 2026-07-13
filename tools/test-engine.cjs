const UpdateEngine =
    require("./core/UpdateEngine.cjs");

(async () => {

    const engine =
        new UpdateEngine();

    await engine.start();

})();