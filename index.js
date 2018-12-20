/**
 * @file cli.js
 * @author Ken Eucker <keneucker@gmail.com>
 */
const gulp = require('gulp'),
	// electronPackager = require("gulp-electron"),
	jsonTransform = require('gulp-json-transform'),
	plumber = require('gulp-plumber'),
	watch = require('gulp-watch'),
	fs = require('fs'),
	path = require('path'),
	yargs = require('yargs'),
	os = require('os'),
	childProcess = require('child_process'),
	quasarSDK = require('@digitaltrends/quasar');

let offspring = childProcess.fork;

/**
 * @classdesc Processes command line arguments to run quasar runtime methods.
 * @hideconstructor
 * @export
 * @class QuasarCli
 */
class QuasarCli {
	constructor() {
		try {
			if ((!yargs.argv.noLogo || yargs.argv.noLogo == false) && process.cwd() == path.resolve(quasarSDK.config.applicationRoot)) {
				const packageJson = require(path.resolve(`${quasarSDK.config.applicationRoot}/package.json`));
				quasarSDK.logQuasarLogo('QuasarCLI', packageJson);
			}
		} catch (e) {

		}

		this.runOnStart = process.title == 'gulp' ||
			yargs.argv.runProcess ||
			yargs.argv.packageApp ||
			yargs.argv.runElectronApp;

		// throw 'constructing CLI';
		if (this.runOnStart) {
			this.run()
				.catch((err) => {
					quasarSDK.logCritical('cli run error', err);
				});
		} else {}
		// throw 'constructed CLI';
	}

	/**
	 * @description returns the application attached to the CLI
	 * @readonly
	 * @memberof QuasarCli
	 */
	get app() {
		return quasarSDK.app || undefined;
	}

	/**
	 * @description the absolute path to the application root
	 * @readonly
	 * @memberof QuasarCli
	 */
	get applicationRoot() {
		return quasarSDK.config.applicationRoot;
	}

	/**
	 * @private
	 * @param {function} cb
	 * @param {function} [resolve=null]
	 */
	definitelyCallFunction(cb, resolve = null) {
		if (process.title == 'gulp') {
			gulp.task('default', (done) => {
				cb();
				done();
				if (resolve) {
					resolve();
				}
			});
		} else {
			cb();
			if (resolve) {
				resolve();
			}
		}
	}

	/**
	 * @description extracts the error from the jobfile
	 * @param {string} jobFile the jobFile path
	 * @returns {string}
	 * @memberof QuasarCli
	 */
	getJobError(jobFile) {
		if (!fs.existsSync(jobFile)) {
			return false;
		}

		const tempFile = fs.readFileSync(jobFile, "utf8");
		argsFile = JSON.parse(tempFile);

		return argsFile.error || true;
	}

	/**
	 * @description creates the application job folders and sets initial vars
	 * @param {*} [appRoot=quasarSDK.config.applicationRoot]
	 * @param {string} [outRoot=`${os.homedir()}/Documents/quasar/`]
	 * @memberof QuasarCli
	 */
	init(appRoot = quasarSDK.config.applicationRoot, outRoot, spawn) {
		offspring = spawn || offspring;

		outRoot = outRoot || path.resolve(`${os.homedir()}/Documents/quasar/`);
		quasarSDK.debug(`applicationRoot folder is correct`, appRoot);
		quasarSDK.debug(`outputRoot folder is correct`, outRoot);
		quasarSDK.debug(`configuration is`, quasarSDK.config);
		quasarSDK.createOutputFolders();

		this.port = process.env.PORT || '3000';

		gulp.task('watchJobs', function () {
			return this.watchJobsFolder(yargs.argv.retryJobs);
		}.bind(this));

		// throw 'CLI initialized';
	}

	/**
	 * @description the absolute path to the jobs folder
	 * @readonly
	 * @memberof QuasarCli
	 */
	get jobsFolder() {
		return quasarSDK.config.jobsFolder;
	}

	/**
	 * @description the absolute path to the output root folder
	 * @readonly
	 * @memberof QuasarCli
	 */
	get outputRoot() {
		return quasarSDK.config.outputRoot;
	}

	/**
	 * @description runs electron-packager on the applicationRoot and uses the electron.js file for driving the application
	 * @summary [INCOMPLETE]
	 * @returns {Promise} gulp chain
	 * @memberof QuasarCli
	 */
	packageIntoElectronApp() {
		const packageJson = require(path.resolve(`${quasarSDK.config.applicationRoot}/package.json`));
		packageJson.name = `quasarWebForm`;
		packageJson.main = `electron.js`;
		packageJson.productName = `quasar`;

		return gulp.src('')
			.pipe(electronPackager({
				src: quasarSDK.config.applicationRoot,
				packageJson: packageJson,
				release: './dist',
				cache: './cache',
				version: packageJson.version,
				packaging: true,
				platforms: ['darwin-x64'],
				platformResources: {
					darwin: {
						CFBundleDisplayName: packageJson.name,
						CFBundleIdentifier: packageJson.name,
						CFBundleName: packageJson.name,
						CFBundleVersion: packageJson.version,
						icon: 'icon.icns'
					}
					// win: {
					// 	"version-string": packageJson.version,
					// 	"file-version": packageJson.version,
					// 	"product-version": packageJson.version,
					// 	"icon": 'icon.ico'
					// }
				}
			}))
			.pipe(gulp.dest(''));
	}

	/**
	 * @description processes a job file and kicks off a build from those args
	 * @param {string} argsFile the path to the argsfile to process
	 * @param {*} data
	 * @memberof QuasarCli
	 */
	processArgsFile(argsFile, data) {
		quasarSDK.debug('will processArgsFile', argsFile);
		quasarSDK.logInfo(`processing argsFile (${argsFile})`);
		quasarSDK.debug(`argsfile ${argsFile} contents`, data);

		return this.spawnCLIForArgsFile(argsFile);
	}

	/**
	 * @description prompts the user from the command line with the given tasks
	 * @param {QuasarTask} tasks defaults to available tasks
	 * @returns {Promise}
	 * @memberof QuasarCli
	 */
	quasarSelectPrompt(tasks) {
		return new Promise(function (resolve, reject) {
			const errorGettingAvailableTasks = 'uhhh nevermind';
			tasks = tasks || quasarSDK.getAvailableTaskNames();

			return quasarSDK.promptConsole([{
				type: 'list',
				name: 'task',
				message: `Select the type of quasar you want to launch`,
				choices: tasks || [errorGettingAvailableTasks]
			}], function (res) {
				if (res.task !== errorGettingAvailableTasks) {
					return quasarSDK.runQuasar(res.task);
				} else {
					logEnd("Allllllrrrriiiiiiiggggghhhhhttttttyyyyyy thhhheeennnnn");
					reject();
				}
				resolve();
			}.bind(this));
		}.bind(this));
	}

	/**
	 * @description runs the command from the arguments passed in from the command line and invocation
	 * @param {object} [args={}]
	 * @returns {Promise}
	 * @memberof QuasarCli
	 */
	run(args = {}) {
		let defaults = {
			appRoot: path.resolve(quasarSDK.config.applicationRoot),
			port: this.port,
			noPrompt: false,
			watchJobs: false,
			qType: false,
			runWebForm: false,
			autoBuildWebForm: false,
			runWebApi: false,
		};
		args = Object.assign(defaults, yargs.argv, args);
		this.port = args.port;

		return new Promise((resolve, reject) => {
				this.init(args.appRoot, null, args.spawnProcess);

				try {
					if (args.runLastSuccessfulBuild || args.reRun) {
						quasarSDK.logInfo(`running the last recorded successful run from the logfile`, process.title);
						return this.definitelyCallFunction(function () {
							return quasarSDK.runLastSuccessfulBuild().then(resolve);
						}.bind(this));
					} else if (args.packageApp) {
						quasarSDK.logInfo('packaging into an application', process.title);
						return this.definitelyCallFunction(function () {
							this.packageIntoElectronApp();
							return resolve();
						}.bind(this));
					} else {
						quasarSDK.logInfo(`running the qausar cli under the process: ${process.title}`);
						if (args.noPrompt) {
							return this.definitelyCallFunction(function () {
								return this.runProcess(args, resolve, reject);
							}.bind(this));
						} else {
							quasarSDK.loadTasks(args.loadTasks, args.loadDefaultTasks || true);
							return this.definitelyCallFunction(function () {
								// TODO: REFACTOR! This is a menu thing! 
								this.quasarSelectPrompt();
								return resolve();
							}.bind(this));
						}
					}
				} catch (e) {
					quasarSDK.logCritical(e.message, e);
					return reject(e);
				}
			})
			.catch(function (e) {
				quasarSDK.logCritical(`cli process error:`, e);
				//throw e;
			}.bind(this));
	}

	/**
	 * @description runs the arguments as a single batch process
	 * @param {object} args
	 * @param {function} resolve
	 * @param {function} reject
	 * @returns {Promise}
	 * @memberof QuasarCli
	 */
	runProcess(args, resolve, reject) {
		if (args.cleanAllOutputFolders) {
			quasarSDK.cleanOutputFolders(true);
			quasarSDK.logSuccess(`Successfully cleaned output root path ${path.resolve(`${quasarSDK.config.outputFolder}`, `../`)}`);
		}

		if (args.cleanOutputFolder) {
			quasarSDK.cleanOutputFolders();
			quasarSDK.logSuccess(`Successfully cleaned output folder path ${quasarSDK.config.outputFolder}`);
		}

		if (args.cleanDevFolders) {
			quasarSDK.cleanDevFolders();
			quasarSDK.logSuccess(`Successfully cleaned the dev folder paths in the application root ${quasarSDK.config.applicationRoot}`);
		}

		if (args.runElectronApp) {
			quasarSDK.logInfo('running the webApp in electron');
			this.definitelyCallFunction(() => {
				this.spawnElectronApp();
			});
			return resolve();
		}

		if (args.argsFile && args.argsFile.length) {
			this.definitelyCallFunction(function () {
				return quasarSDK.runFromArgsFile(null, null, args.argsFile)
					.then(resolve)
					.catch((e) => {
						quasarSDK.error('cli error:', e);
					});
			});
		}

		if (args.qType) {
			quasarSDK.logInfo('automated quasar build from quasArgs');
			this.definitelyCallFunction(function () {
				return quasarSDK.runQuasar(args.qType, args)
					.then(resolve)
					.catch((e) => {
						quasarSDK.error('cli error:', e);
					});
			});
		}

		if (args.runWebApi || args.runWebForm || args.runWebApp) {
			this._api = this._api || require(`@digitaltrends/quasar-web`);
			this._app = this._api.app;
		}

		if (args.runWebApi) {
			quasarSDK.debug(`will run webApi`);
			this._api.run(null, args.port);
		}

		if (args.watchJobs) {
			quasarSDK.debug(`will run watchJobs`);
			quasarSDK.runQuasar('watchJobs');
		}

		if (args.runWebForm) {
			// TODO: use more intelligent path
			if (!this.spawnWebForm(args.runWebApi)) {
				if (args.autoBuildWebForm) {
					quasarSDK.logCritical('automated quasar build of `quasar webform`');
					quasarSDK.runQuasar('quasar-webform', null, function () {
						const webformRoot = path.resolve(`${quasarSDK.config.applicationRoot}/app/webform/`);
						const packageManagerModulePath = path.resolve(`${quasarSDK.config.moduleRoot}/../../yarn/bin/yarn.js`);

						quasarSDK.debug(`will install webform dependencies using yarn: ${packageManagerModulePath}`, webformRoot);
						offspring(packageManagerModulePath, ['install'], {
							stdio: 'inherit',
							cwd: webformRoot,
							detached: true,
							env: {
								ELECTRON_RUN_AS_NODE: 1
							},
						}).on('close', (msg) => {
							quasarSDK.logInfo('finished installing webform dependencies', msg);
							quasarSDK.logInfo('attempting another run of the quasar webform');
							if (!this.spawnWebForm(args.runWebApi)) {
								quasarSDK.logError(`Can't do that!`);
								return reject();
							} else {
								return resolve();
							}
						});
					}.bind(this));

					return true;
				} else {
					quasarSDK.logError(`cannot run webform because ${quasarSDK.config.applicationRoot}/app/quasar/Webform/app.js has not been built yet, run again with option --autoBuildWebForm=true to auto build the webform.`);
					return reject();
				}
			} else {
				return resolve();
			}
		}

		if (args.runWebApp) {
			// TODO: use more intelligent path
			if (!this.spawnWebApp(args.runWebApi)) {
				if (args.autoBuildWebApp) {
					quasarSDK.logInfo('automated quasar build of `quasarWebApp`');
					quasarSDK.runQuasar('quasar-webapp', null, function () {
						quasarSDK.logInfo('attempting another run of the quasarWebApp');
						if (!this.spawnWebApp(args.runWebApi)) {
							quasarSDK.logError(`Can't do that!`);
							return reject();
						} else {
							return resolve();
						}
					}.bind(this));

					return true;
				} else {
					quasarSDK.logCritical(`cannot run webapp because ${quasarSDK.config.applicationRoot}/app/quasar/WebApp/app.js has not been built yet, run again with option --autoBuildWebApp=true to auto build the webapp.`);
					return reject();
				}
			} else {
				return resolve();
			}
		}

		return resolve();
	}

	/**
	 * @description creates a new child process of node or another command
	 * @memberof QuasarCli
	 * @param {array} [args=[]]
	 * @param {boolean} [synchronous=false]
	 */
	spawnCLIForArgsFile(argsFile, synchronous = false) {
		const args = ['--runProcess=true', '--noPrompt=true', `--argsFile=${argsFile}`];
		const nodeModule = `${quasarSDK.config.applicationRoot}/index.js`;

		if (yargs.argv.log) {
			args.push(`--log=${yargs.argv.log}`);
		}

		quasarSDK.debug(`Running module ${nodeModule} ${args.join(' ')}`);
		const spawnOptions = {
			stdio: 'inherit',
			// detached: true,
			env: {
				ELECTRON_RUN_AS_NODE: 1
			},
		};

		//dev only
		if (synchronous) {
			return childProcess.spawnSync(nodeModule, args, spawnOptions);
		}

		offspring(nodeModule, args, spawnOptions)
			.on('error', (err) => {
				quasarSDK.logError('SPAWN error:', err);
			})
			.on('data', (data) => {
				quasarSDK.logData('DATA: ', data);
			})
			.on('close', (msg) => {
				quasarSDK.logInfo(`command ended with message: ${msg}`);
			});
	}

	/**
	 * @description spawns a new instance of electron from the applicationRoot folder
	 * @memberof QuasarCli
	 */
	spawnElectronApp() {

		childProcess.spawn('electron', ['.'], {
				stdio: "inherit",
				detached: true,
				env: {
					ELECTRON_RUN_AS_NODE: 1
				},
			})
			.on("error", (err) => {
				quasarSDK.logError('SPAWN error:', err);
			})
			.on("data", (data) => {
				quasarSDK.logData('DATA: ', data);
			})
			.on("close", (msg) => {
				quasarSDK.logInfo(`command ended with message: ${msg}`);
			});
	}

	/**
	 * @description spawns the web app and web api in an express application
	 * @returns {boolean} whether or not the web app was successfully run
	 * @memberof QuasarCli
	 */
	spawnWebApp() {
		const webAppPath = path.resolve(`${quasarSDK.config.applicationRoot}/app/app.js`);

		if (fs.existsSync(webAppPath)) {
			quasarSDK.logInfo(`loading the webform application ${webAppPath}`);

			this.webApp = require(webAppPath);
			this.webApp.init();
			// console.log('this should attach to the app', api.app);
			this.webApp.run(this._api.app, this._api.port);

			return true;
		}

		return false;
	}

	/**
	 * @description spawns the web form and web api in an express application
	 * @returns {boolean} whether or not the web form was successfully run
	 * @memberof QuasarCli
	 */
	spawnWebForm() {
		const webFormPath = path.resolve(`${quasarSDK.config.applicationRoot}/app/webform/app.js`);

		if (fs.existsSync(webFormPath)) {
			quasarSDK.logInfo(`loading the webform application ${webFormPath}`);

			this.webForm = require(webFormPath);
			this.webForm.init();
			// console.log('this should attach to the app', api.app);
			this.webForm.run(this._api.app, this._api.port);

			return true;
		}

		return false;
	}

	/**
	 * @description watches the jobs created folder for new files created and process the argsFile as a new quasar build
	 * @memberof QuasarCli
	 */
	watchJobsFolder() {
		const jobQueueFolder = path.resolve(`${this.jobsFolder}/created`);
		const src = path.resolve(`${jobQueueFolder}/*.json`);
		quasarSDK.logSuccess(`watching folder ${jobQueueFolder} for new or changed files to build from`);
		return watch(src, {
				ignoreInitial: true,
				verbose: true,
				allowEmpty: true,
				events: ['add'],
			}, function (file) {
				return gulp.src(file.path, {
						allowEmpty: true
					})
					.pipe(jsonTransform(function (data, file) {
						try {
							this.processArgsFile(file.path, data);
						} catch (e) {
							quasarSDK.logError('error', e);
						}
						return {};
					}.bind(this)))
					.pipe(plumber())
			}.bind(this))
			.pipe(plumber())
	}
}

module.exports = new QuasarCli();
