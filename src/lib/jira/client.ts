/**
 * Jira Cloud API Client
 * Handles all communication with Jira Cloud API using Basic Authentication
 */

interface JiraBoard {
  id: number;
  key: string;
  name: string;
  type: string;
}

interface JiraSprint {
  id: number;
  key: string;
  name: string;
  state: string;
  boardId: number;
}

interface JiraIssueType {
  id: string;
  name: string;
  iconUrl: string;
}

interface JiraStatus {
  id: string;
  name: string;
  statusCategory?: {
    key: string;
    colorName: string;
    name: string;
  };
}

interface JiraPriority {
  id: string;
  name: string;
  iconUrl?: string;
}

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    description: string | null;
    issuetype: JiraIssueType;
    status: JiraStatus;
    priority: JiraPriority | null;
    customfield_10016?: number | null; // Story Points field
    [key: string]: unknown;
  };
}

interface JiraBoardsResponse {
  maxResults: number;
  startAt: number;
  total: number;
  isLast: boolean;
  values: JiraBoard[];
}

interface JiraSprintsResponse {
  maxResults: number;
  startAt: number;
  total: number;
  isLast: boolean;
  values: JiraSprint[];
}

interface JiraIssuesResponse {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

interface JiraBacklogResponse {
  expand: string;
  issues: JiraIssue[];
  backlog: JiraIssue[];
}

interface JiraIssueUpdate {
  fields: {
    customfield_10016?: number | null;
    [key: string]: unknown;
  };
}

interface JiraUser {
  self: string;
  accountId: string;
  emailAddress: string;
  displayName: string;
  active: boolean;
  timeZone: string;
}

export interface JiraField {
  id: string;
  key?: string;
  name: string;
  custom: boolean;
  schema?: {
    type: string;
    custom?: string;
    customId?: number;
  };
}

export interface JiraConfig {
  jiraUrl: string;
  email: string;
  apiToken: string;
  storyPointsField?: string;
}

export interface FormattedIssue {
  key: string;
  summary: string;
  description: string | null;
  type: string;
  status: string;
  priority: string | null;
  storyPoints: number | null;
}

export class JiraClient {
  private jiraUrl: string;
  private authHeader: string;
  private storyPointsField: string;

  constructor(config: JiraConfig) {
    // Ensure https:// prefix and remove trailing slash
    let url = config.jiraUrl.replace(/\/$/, "");
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    this.jiraUrl = url;
    const credentials = `${config.email}:${config.apiToken}`;
    const base64Credentials = Buffer.from(credentials).toString("base64");
    this.authHeader = `Basic ${base64Credentials}`;
    this.storyPointsField = config.storyPointsField || "customfield_10016";
  }

  private async makeRequest<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.jiraUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Jira API Error (${response.status}): ${response.statusText} - ${errorBody}`
      );
    }

    // Handle 204 No Content (e.g. PUT /issue/{key} returns no body)
    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return undefined as T;
    }

    // Some responses may have no body even without 204
    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  async testConnection(): Promise<JiraUser> {
    return this.makeRequest<JiraUser>("GET", "/rest/api/3/myself");
  }

  async getBoards(): Promise<JiraBoard[]> {
    const response = await this.makeRequest<JiraBoardsResponse>(
      "GET",
      "/rest/agile/1.0/board?maxResults=50"
    );
    return response.values;
  }

  async getSprints(boardId: string): Promise<JiraSprint[]> {
    const response = await this.makeRequest<JiraSprintsResponse>(
      "GET",
      `/rest/agile/1.0/board/${boardId}/sprint?state=active,future&maxResults=50`
    );
    return response.values;
  }

  async getSprintIssues(sprintId: string, typesFilter?: string[]): Promise<FormattedIssue[]> {
    // Build JQL filter for issue types
    let jqlParam = "";
    if (typesFilter && typesFilter.length > 0) {
      const types = typesFilter.map((t) => `"${t}"`).join(", ");
      jqlParam = `&jql=issuetype in (${encodeURIComponent(types)})`;
    }
    const response = await this.makeRequest<JiraIssuesResponse>(
      "GET",
      `/rest/agile/1.0/sprint/${sprintId}/issue?fields=summary,description,issuetype,status,priority,${this.storyPointsField}&maxResults=100${jqlParam}`
    );
    return response.issues.map((issue) => this.formatIssue(issue));
  }

  async getBacklogIssues(boardId: string): Promise<FormattedIssue[]> {
    const response = await this.makeRequest<JiraBacklogResponse>(
      "GET",
      `/rest/agile/1.0/board/${boardId}/backlog?fields=summary,description,issuetype,status,priority,${this.storyPointsField}`
    );

    // Combine sprint issues and backlog issues
    const allIssues = [...response.issues, ...response.backlog];
    return allIssues.map((issue) => this.formatIssue(issue));
  }

  async getIssue(issueKey: string): Promise<FormattedIssue> {
    const issue = await this.makeRequest<JiraIssue>(
      "GET",
      `/rest/api/3/issue/${issueKey}?fields=summary,description,issuetype,status,priority,${this.storyPointsField}`
    );
    return this.formatIssue(issue);
  }

  async searchIssues(jql: string): Promise<FormattedIssue[]> {
    const response = await this.makeRequest<JiraIssuesResponse>(
      "GET",
      `/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=summary,description,issuetype,status,priority,${this.storyPointsField}&maxResults=100`
    );
    return response.issues.map((issue) => this.formatIssue(issue));
  }

  async updateStoryPoints(issueKey: string, points: number): Promise<void> {
    const body: JiraIssueUpdate = {
      fields: {
        [this.storyPointsField]: points,
      },
    };
    await this.makeRequest<unknown>(
      "PUT",
      `/rest/api/3/issue/${issueKey}`,
      body
    );

    // Add a refinement comment
    const now = new Date();
    const cstTime = now.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      dateStyle: "long",
      timeStyle: "short",
    });
    await this.addRefinementComment(issueKey, cstTime, points);
  }

  async addRefinementComment(issueKey: string, dateTime: string, points: number): Promise<void> {
    await this.makeRequest<unknown>(
      "POST",
      `/rest/api/3/issue/${issueKey}/comment`,
      {
        body: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: `Story refined on ${dateTime} CST and story points given `,
                },
                {
                  type: "text",
                  text: String(points),
                  marks: [{ type: "strong" }],
                },
              ],
            },
          ],
        },
      }
    );
  }

  /**
   * Add a plain status comment to a Jira issue — used when there is
   * no consensus or the story was skipped due to time.
   * reason: 'no_consensus' | 'no_time' | 'skipped'
   */
  async addStatusComment(
    issueKey: string,
    reason: "no_consensus" | "no_time" | "skipped",
    smNote?: string
  ): Promise<void> {
    const now = new Date();
    const cstTime = now.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      dateStyle: "long",
      timeStyle: "short",
    });

    const reasonText =
      reason === "no_consensus"
        ? "No consensus reached"
        : reason === "no_time"
        ? "Not estimated — ran out of time"
        : "Skipped during session";

    const content: unknown[] = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: `Refinement session on ${cstTime} CST — ` },
          { type: "text", text: reasonText, marks: [{ type: "strong" }] },
          { type: "text", text: ". Story requires further discussion before next refinement." },
        ],
      },
    ];

    if (smNote?.trim()) {
      content.push({
        type: "paragraph",
        content: [
          { type: "text", text: "SM note: ", marks: [{ type: "strong" }] },
          { type: "text", text: smNote.trim() },
        ],
      });
    }

    await this.makeRequest<unknown>("POST", `/rest/api/3/issue/${issueKey}/comment`, {
      body: { type: "doc", version: 1, content },
    });
  }

  async getFields(): Promise<JiraField[]> {
    return this.makeRequest<JiraField[]>("GET", "/rest/api/3/field");
  }

  private formatIssue(issue: JiraIssue): FormattedIssue {
    const storyPoints = issue.fields[this.storyPointsField] as number | null | undefined;

    return {
      key: issue.key,
      summary: issue.fields.summary,
      description: issue.fields.description,
      type: issue.fields.issuetype.name,
      status: issue.fields.status.name,
      priority: issue.fields.priority?.name || null,
      storyPoints: storyPoints || null,
    };
  }
}
