var fs = require('fs');
var path = require('path');
var ForkTsCheckerWebpackPlugin = require('../../lib/index');
var helpers = require('./helpers');

describe.each([[true], [false]])(
  '[INTEGRATION] common tests - useTypescriptIncrementalApi: %s',
  useTypescriptIncrementalApi => {
    var plugin;

    const overrideOptions = { useTypescriptIncrementalApi };

    function createCompiler(
      options,
      happyPackMode,
      entryPoint = './src/index.ts'
    ) {
      options = options || {};
      options = { ...options, ...overrideOptions };
      var compiler = helpers.createCompiler({
        pluginOptions: options,
        happyPackMode,
        entryPoint
      });
      plugin = compiler.plugin;
      return compiler.compiler;
    }

    const skipIfIncremental = useTypescriptIncrementalApi ? it.skip : it;

    /**
     * Implicitly check whether killService was called by checking that
     * the service property was set to undefined.
     * @returns [boolean] true if killService was called
     */
    function killServiceWasCalled() {
      return plugin.service === undefined;
    }

    it('should allow to pass no options', () => {
      expect(function() {
        new ForkTsCheckerWebpackPlugin();
      }).not.toThrowError();
    });

    it('should detect paths', () => {
      var plugin = new ForkTsCheckerWebpackPlugin({ tslint: true });

      expect(plugin.tsconfig).toBe('./tsconfig.json');
      expect(plugin.tslint).toBe(true);
    });

    it('should set logger to console by default', () => {
      var plugin = new ForkTsCheckerWebpackPlugin({});

      expect(plugin.logger).toBe(console);
    });

    it('should set watch to empty array by default', () => {
      var plugin = new ForkTsCheckerWebpackPlugin({});

      expect(plugin.watch).toEqual([]);
    });

    it('should set watch to one element array for string', () => {
      var plugin = new ForkTsCheckerWebpackPlugin({
        useTypescriptIncrementalApi: false,
        watch: '/test'
      });

      expect(plugin.watch).toEqual(['/test']);
    });

    it('should find lint warnings', callback => {
      const fileName = 'lintingError2';
      const { compiler } = helpers.testLintAutoFixTest({
        pluginOptions: {
          tslint: path.resolve(__dirname, './project/tslint.json'),
          ignoreLintWarnings: false,
          ...overrideOptions
        },
        fileName
      });

      compiler.run((err, stats) => {
        expect(
          stats.compilation.warnings.filter(warning =>
            warning.message.includes('missing whitespace')
          ).length
        ).toBeGreaterThan(0);
        callback();
      });
    });

    it('should not print warnings when ignoreLintWarnings passed as option', callback => {
      const fileName = 'lintingError2';
      const { compiler } = helpers.testLintAutoFixTest({
        fileName,
        pluginOptions: {
          tslint: path.resolve(__dirname, './project/tslint.json'),
          ignoreLintWarnings: true,
          ...overrideOptions
        }
      });
      compiler.run((err, stats) => {
        expect(
          stats.compilation.warnings.filter(warning =>
            warning.message.includes('missing whitespace')
          ).length
        ).toBe(0);
        callback();
      });
    });

    it('should not mark warnings as errors when ignoreLintWarnings passed as option', callback => {
      const fileName = 'lintingError2';
      const { compiler } = helpers.testLintAutoFixTest({
        fileName,
        pluginOptions: {
          tslint: path.resolve(__dirname, './project/tslint.json'),
          ignoreLintWarnings: true,
          ...overrideOptions
        }
      });
      compiler.run((err, stats) => {
        expect(
          stats.compilation.errors.filter(error =>
            error.message.includes('missing whitespace')
          ).length
        ).toBe(0);
        callback();
      });
    });

    it('should find semantic errors', callback => {
      var compiler = createCompiler({
        tsconfig: 'tsconfig-semantic-error-only.json'
      });

      compiler.run(function(err, stats) {
        expect(stats.compilation.errors.length).toBeGreaterThanOrEqual(1);
        callback();
      });
    });

    it('should support custom resolution', function(callback) {
      var compiler = createCompiler({
        tsconfig: 'tsconfig-weird-resolutions.json',
        resolveModuleNameModule: `${__dirname}/project/weirdResolver.js`,
        resolveTypeReferenceDirectiveModule: `${__dirname}/project/weirdResolver.js`
      });

      compiler.run(function(err, stats) {
        expect(stats.compilation.errors.length).toBe(0);
        callback();
      });
    });

    skipIfIncremental('should support custom resolution w/ "paths"', function(
      callback
    ) {
      var compiler = createCompiler({
        tsconfig: 'tsconfig-weird-resolutions-with-paths.json',
        resolveModuleNameModule: `${__dirname}/project/weirdResolver.js`,
        resolveTypeReferenceDirectiveModule: `${__dirname}/project/weirdResolver.js`
      });

      compiler.run(function(err, stats) {
        expect(stats.compilation.errors.length).toBe(0);
        callback();
      });
    });

    it('should fix linting errors with tslintAutofix flag set to true', callback => {
      const fileName = 'lintingError1';
      const {
        compiler,
        formattedFileContents,
        targetFileName
      } = helpers.testLintAutoFixTest({
        fileName,
        pluginOptions: {
          tslintAutoFix: true,
          tslint: path.resolve(__dirname, './project/tslint.autofix.json'),
          tsconfig: false,
          ...overrideOptions
        }
      });
      compiler.run((err, stats) => {
        expect(stats.compilation.warnings.length).toBe(0);

        var fileContents = fs.readFileSync(targetFileName, {
          encoding: 'utf-8'
        });
        expect(fileContents).toBe(formattedFileContents);
        callback();
      });
    });

    it('should not fix linting by default', callback => {
      const fileName = 'lintingError2';
      const { compiler } = helpers.testLintAutoFixTest({
        fileName,
        pluginOptions: {
          tslint: true,
          ...overrideOptions
        }
      });
      compiler.run((err, stats) => {
        expect(stats.compilation.warnings.length).toBe(7);
        callback();
      });
    });

    it('should block emit on build mode', callback => {
      var compiler = createCompiler();

      if ('hooks' in compiler) {
        const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
          compiler
        );
        forkTsCheckerHooks.emit.tap(
          'should block emit on build mode',
          function() {
            expect(true).toBe(true);
            callback();
          }
        );
      } else {
        compiler.plugin('fork-ts-checker-emit', function() {
          expect(true).toBe(true);
          callback();
        });
      }

      compiler.run(function() {});
    });

    it('should not block emit on watch mode', callback => {
      var compiler = createCompiler();
      var watching = compiler.watch({}, function() {});

      if ('hooks' in compiler) {
        const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
          compiler
        );
        forkTsCheckerHooks.done.tap(
          'should not block emit on watch mode',
          function() {
            watching.close(function() {
              expect(true).toBe(true);
              callback();
            });
          }
        );
      } else {
        compiler.plugin('fork-ts-checker-done', function() {
          watching.close(function() {
            expect(true).toBe(true);
            callback();
          });
        });
      }
    });

    it('should block emit if async flag is false', callback => {
      var compiler = createCompiler({ async: false });
      var watching = compiler.watch({}, function() {});

      if ('hooks' in compiler) {
        const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
          compiler
        );
        forkTsCheckerHooks.emit.tap(
          'should block emit if async flag is false',
          function() {
            watching.close(function() {
              expect(true).toBe(true);
              callback();
            });
          }
        );
      } else {
        compiler.plugin('fork-ts-checker-emit', function() {
          watching.close(function() {
            expect(true).toBe(true);
            callback();
          });
        });
      }
    });

    it('kills the service when the watch is done', done => {
      var compiler = createCompiler();
      var watching = compiler.watch({}, function() {});

      if ('hooks' in compiler) {
        const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
          compiler
        );
        forkTsCheckerHooks.done.tap(
          'kills the service when the watch is done',
          function() {
            watching.close(function() {
              expect(killServiceWasCalled()).toBe(true);
              done();
            });
          }
        );
      } else {
        compiler.plugin('fork-ts-checker-done', function() {
          watching.close(function() {
            expect(killServiceWasCalled()).toBe(true);
            done();
          });
        });
      }
    });

    it('should throw error if config container wrong tsconfig.json path', () => {
      expect(function() {
        createCompiler({
          tsconfig: '/some/path/that/not/exists/tsconfig.json'
        });
      }).toThrowError();
    });

    it('should throw error if config container wrong tslint.json path', () => {
      expect(function() {
        createCompiler({
          tslint: '/some/path/that/not/exists/tslint.json'
        });
      }).toThrowError();
    });

    it('should detect tslint path for true option', () => {
      expect(function() {
        createCompiler({ tslint: true });
      }).not.toThrowError();
    });

    it('should allow delaying service-start', callback => {
      var compiler = createCompiler();
      var delayed = false;

      if ('hooks' in compiler) {
        const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
          compiler
        );
        forkTsCheckerHooks.serviceBeforeStart.tapAsync(
          'should allow delaying service-start',
          function(cb) {
            setTimeout(function() {
              delayed = true;

              cb();
            }, 0);
          }
        );

        forkTsCheckerHooks.serviceBeforeStart.tap(
          'should allow delaying service-start',
          function() {
            expect(delayed).toBe(true);
            callback();
          }
        );
      } else {
        compiler.plugin('fork-ts-checker-service-before-start', function(cb) {
          setTimeout(function() {
            delayed = true;

            cb();
          }, 0);
        });

        compiler.plugin('fork-ts-checker-service-start', function() {
          expect(delayed).toBe(true);
          callback();
        });
      }

      compiler.run(function() {});
    });

    it('should respect "tslint.json"s hierarchy when config-file not specified', callback => {
      const { compiler } = helpers.createCompiler({
        pluginOptions: {
          tslint: true,
          ...overrideOptions
        },
        entryPoint: './index.ts',
        context: './project_hierarchical_tslint'
      });
      compiler.run((err, stats) => {
        /*
         * there are three identical arrow functions
         * in index.ts, lib/func.ts and lib/utils/func.ts
         * and plugin should warn three times on typedef-rule
         * twice on "arrow-call-signature" and once on "arrow-parameter"
         * because this rule is overriden inside lib/tslint.json
         * */
        expect(stats.compilation.warnings.length).toBe(3);
        callback();
      });
    });

    it('should not find syntactic errors when checkSyntacticErrors is false', callback => {
      var compiler = createCompiler({ checkSyntacticErrors: false }, true);

      compiler.run(function(error, stats) {
        const syntacticErrorNotFoundInStats = stats.compilation.errors.every(
          error =>
            !error.rawMessage.includes(
              helpers.expectedErrorCodes.expectedSyntacticErrorCode
            )
        );
        expect(syntacticErrorNotFoundInStats).toBe(true);
        callback();
      });
    });

    it('should find syntactic errors when checkSyntacticErrors is true', callback => {
      var compiler = createCompiler({ checkSyntacticErrors: true }, true);

      compiler.run(function(error, stats) {
        const syntacticErrorFoundInStats = stats.compilation.errors.some(
          error =>
            error.rawMessage.includes(
              helpers.expectedErrorCodes.expectedSyntacticErrorCode
            )
        );
        expect(syntacticErrorFoundInStats).toBe(true);
        callback();
      });
    });
  }
);