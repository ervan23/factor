import {
  addPostType,
  addContentRoute,
  setting,
  pushToFilter,
  addPostSchema
} from "@factor/api"

import jobsSchema from "./schema"

const baseRoute = setting("jobs.postRoute")

export const setup = (): void => {
  addPostSchema(jobsSchema)

  addPostType({
    postType: "jobs",
    baseRoute,
    icon: require("./img/jobs.svg"),
    model: "JobPost",
    nameIndex: "Jobs",
    nameSingle: "Jobs Post",
    namePlural: "Jobs Posts"
  })

  addContentRoute({
    path: setting("jobs.indexRoute") ?? "/",
    component: setting("jobs.components.jobsWrap"),
    children: [
      {
        path: "/",
        component: setting("jobs.components.jobsIndex")
      },
      {
        path: `${setting("jobs.postRoute")}/:permalink`,
        component: setting("jobs.components.jobsSingle")
      }
    ]
  })

  pushToFilter({
    key: "jobEdit",
    hook: "post-edit-components",
    item: {
      postType: ["jobs"],
      name: "Job Settings",
      component: setting("jobs.settings.settingsPanel")
    }
  })
}
setup()
