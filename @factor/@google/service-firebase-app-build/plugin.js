const { ensureFileSync, writeFileSync } = require("fs-extra")
const { resolve, dirname } = require("path")
const merge = require("deepmerge")

export default Factor => {
  return new (class {
    constructor() {
      // Webpack can't handle the node targeted firebase-admin package
      // This allows us to use this plugin in both environments
      Factor.$filters.add("webpack-ignore-modules", _ => {
        _.push("firebase-admin")
        return _
      })

      // Fix poorly designed Firebase packages
      // https://github.com/firebase/firebase-js-sdk/pull/1536#issuecomment-473408965
      Factor.$filters.add("webpack-aliases-server", _ => {
        const firebaseDir = dirname(require.resolve(`@firebase/app`))
        _["@firebase/app$"] = resolve(firebaseDir, "index.node.cjs.js")

        return _
      })

      // validate: value => {
      //   if (typeof value != "object") {
      //     return "The answer must be readable as valid JSON."
      //   } else {
      //     return true
      //   }
      // },
      // filter: value => {
      //   return JSON.parse(value)
      // }

      Factor.$stack.registerProvider({
        title: "Firebase",
        description: "Datastore, hosting, cloud functions, file storage.",
        settings: {
          group: "firebase",
          secrets: [
            {
              key: "serviceAccount",
              input: "editor",
              message: "Your Firebase/Google Service Account key (JSON)",
              parsers: {
                validate: v => {
                  if (typeof v != "object") {
                    return "The answer must be readable as valid JSON."
                  } else {
                    return true
                  }
                },
                filter: v => {
                  return JSON.parse(v)
                }
              }
            }
          ],
          config: ["apiKey", "authDomain", "databaseURL", "projectId", "storageBucket", "messagingSenderId"],
          envs: "multi-optional"
        },
        provider: "firebase"
      })

      this.appPath = Factor.$paths.get("app")
      this.publicDir = Factor.$paths.folder("dist")

      Factor.$filters.add("cli-tasks", (_, args) => {
        _.push({
          command: (ctx, task) => {
            this.createFirebaseJson()
            this.createFirebaseRC()
            //task.title = `${task.title} (done)`
          },
          title: "Generating Firebase config files"
        })

        return _
      })

      Factor.$stack.add("deploy-app", () => {
        Factor.$filters.add("cli-tasks-deploy-app", _ => {
          _.push({
            command: "firebase",
            args: ["use", Factor.$config.setting("env")],
            title: `Setting Firebase Project [${Factor.$config.setting("env")}]`
          })
          _.push({
            command: "firebase",
            args: ["deploy"],
            title: `Deploying App to Firebase [${Factor.$config.setting("env")}]`
          })

          return _
        })
      })

      Factor.$filters.add("initialize-build", () => {
        this.createBuildFirebaseInstance()
      })
    }

    createBuildFirebaseInstance() {
      const { firebase: { databaseURL, serviceAccount } = {} } = Factor.$config.settings()

      const admin = require("firebase-admin")
      if (serviceAccount && serviceAccount.private_key) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount), databaseURL })

        admin.firestore()
      }
    }

    createFirebaseJson() {
      const { firebaseJson = {} } = Factor.$config.setting("firebase") || {}
      const fileJson = Factor.$filters.apply("firebase-config", {})

      this.writeFile("firebase.json", merge.all([fileJson, firebaseJson]))
    }

    createFirebaseRC() {
      const {
        development: { firebase: { projectId: devProject } = {} } = {},
        production: { firebase: { projectId: prodProject } = {} } = {},
        config: { firebase: { projectId: allProject = "" } = {} } = {}
      } = require(Factor.$paths.get("config-file-public"))

      const { firebaserc = {} } = Factor.$config.setting("firebase") || {}

      const fileJson = {
        projects: {
          production: prodProject || allProject,
          development: devProject || allProject
        }
      }

      this.writeFile(".firebaserc", merge.all([fileJson, firebaserc]))
    }

    writeFile(name, fileJson) {
      const destinationFile = resolve(this.appPath, name)
      ensureFileSync(destinationFile)
      writeFileSync(destinationFile, JSON.stringify(fileJson, null, "  "))
    }
  })()
}