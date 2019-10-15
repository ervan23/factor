import mongoose from "mongoose"

export default Factor => {
  return new (class {
    constructor() {
      this.DB = require("./server-db").default(Factor)
      Factor.$filters.callback("endpoints", { id: "db", handler: this })
      Factor.$filters.callback("initialize-server", () => this.setModels())
    }

    objectId(str) {
      return mongoose.Types.ObjectId(str)
    }

    async populate({ _ids }) {
      const _in = Array.isArray(_ids) ? _ids : [_ids]
      const result = await this.model("post").find({
        _id: { $in: _in }
      })

      return Array.isArray(_ids) ? result : result[0]
    }

    // Must be non-async so we can use chaining
    model(name) {
      const { Schema } = mongoose
      // If model doesnt exist, create a vanilla one
      if (!this._models[name]) {
        // For server restarts
        if (mongoose.models[name]) {
          this._schemas[name] = mongoose.modelSchemas[name]
          this._models[name] = mongoose.models[name]
        } else if (name) {
          this._models[name] = this.model("post").discriminator(name, new Schema())
        } else {
          this._models[name] = this.model("post")
        }
      }
      return this._models[name]
    }

    schema(name) {
      return this._schemas[name] || null
    }

    // Set schemas and models
    // For server restarting we need to inherit from already constructed mdb models if they exist
    setModel(config, postModel = false) {
      const { Schema } = mongoose
      const { schema, options, callback, name } = config

      let _model
      let _schema
      if (mongoose.models[name]) {
        _schema = mongoose.modelSchemas[name]
        _model = mongoose.models[name]
      } else {
        _schema = new Schema(schema, options)
        if (callback) callback(_schema)

        if (!postModel) {
          _model = mongoose.model(name, _schema)
        } else {
          _model = postModel.discriminator(name, _schema)
          _model.ensureIndexes()
        }
      }

      this._schemas[name] = _schema
      this._models[name] = _model

      return _model
    }

    setModels() {
      this._schemas = {}
      this._models = {}

      const postSchemas = Factor.$mongo.getSchemas()
      const primarySchema = Factor.$mongo.getSchema("post")
      const primaryModel = this.setModel(primarySchema)

      postSchemas.forEach(s => {
        if (s.name != "post") {
          this.setModel(s, primaryModel)
        }
      })
    }

    // Ensure all post indexes are up to date .
    // https://thecodebarbarian.com/whats-new-in-mongoose-5-2-syncindexes
    async _syncSchemaIndexes() {
      for (let key of Object.keys(this._models)) {
        const model = this._models[key]

        await model.ensureIndexes()
      }
      return
    }
  })()
}
