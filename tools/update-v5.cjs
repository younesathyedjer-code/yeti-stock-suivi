const CoreRunner =
    require("./core/CoreRunner.cjs");

(async () => {

    const runner =
        new CoreRunner();

    await runner.run();

})();