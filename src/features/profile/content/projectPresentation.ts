import type { Project } from './types.ts'

/** Both rendering paths summarize the same validated public projects. */
export const getProjectOverview = (projects: readonly Project[]) => [
  { label: '公开项目', count: projects.length },
  { label: '持续制作', count: projects.filter(project => project.status === 'active').length },
  { label: '已归档', count: projects.filter(project => project.status === 'archived').length },
]
