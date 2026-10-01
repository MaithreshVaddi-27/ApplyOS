// Connector registry: maps BoardKind to its search Connector and detail fetcher.

import type { BoardKind, CompanyBoard } from "../types.js"
import {
  greenhouseSearch,
  greenhouseDetail,
  leverSearch,
  leverDetail,
  ashbySearch,
  ashbyDetail,
  smartrecruitersSearch,
  smartrecruitersDetail,
} from "./ats.js"
import {
  amazonSearch,
  amazonDetail,
  salesforceSearch,
  salesforceDetail,
  workdaySearch,
  workdayDetail,
  eightfoldSearch,
  eightfoldDetail,
} from "./enterprise.js"

export interface BoardConnector {
  search: (board: CompanyBoard, opts: { query?: string; maxPages: number }) => Promise<import("../types.js").NormalizedJob[]>
  detail: (board: CompanyBoard, id: string) => Promise<string>
}export const CONNECTORS: Record<BoardKind, BoardConnector> = {
  amazon: { search: amazonSearch, detail: amazonDetail },
  salesforce: { search: salesforceSearch, detail: salesforceDetail },
  greenhouse: { search: greenhouseSearch, detail: greenhouseDetail },
  lever: { search: leverSearch, detail: leverDetail },
  ashby: { search: ashbySearch, detail: ashbyDetail },
  smartrecruiters: { search: smartrecruitersSearch, detail: smartrecruitersDetail },
  workday: { search: workdaySearch, detail: workdayDetail },
  eightfold: { search: eightfoldSearch, detail: eightfoldDetail },
}

export function connectorFor(board: BoardKind): BoardConnector | undefined {
  return CONNECTORS[board]
}
