import { isEqual } from 'lodash';

import { Engine } from '@kb-abstracts';
import { PullRequestService, RepoService, UserService } from '@kb-api';
import {
  IGithubPullRequest,
  IGithubPullRequestEvent,
  IGithubRepo,
  IGithubReview,
  IGithubReviewComment,
  IGithubUser
} from '@kb-interfaces';
import { IReviewComment, PRStatus, PullRequest, Repo, User } from '@kb-models';


// TODO@Thatkookooguy: #343 Ensure PR exists in db for every event
// TODO@Thatkookooguy: #344 Ensure all users exists in db for every event
// TODO@Thatkookooguy: #345 Ensure repo exists in db for every event
export class GithubEngine extends Engine<IGithubPullRequestEvent> {

  constructor(
    private usersService: UserService,
    private reposService: RepoService,
    private pullRequestsService: PullRequestService
  ) {
    super();
  }

  async handleNewConnection(
    eventData: IGithubPullRequestEvent
  ): Promise<void> {
    const repoDto = new Repo({
      fullname: eventData.repository.full_name,
      name: eventData.repository.name,
      url: eventData.repository.html_url,
      organization: eventData.repository.owner.type === 'Organization' ?
        eventData.repository.owner.login : undefined
    });

    await this.reposService.create(repoDto);

    return;
  }
  async handlePullRequestOpened(
    eventData: IGithubPullRequestEvent
  ): Promise<void> {
    const {
      githubCreator,
      githubOwner,
      githubPR
    } = this.extractGithubEntities(eventData);

    const creator = this.extractUser(githubCreator);
    await this.usersService.create(creator);

    let organization: User;
    if (githubOwner.type === 'Organization') {
      organization = this.extractUser(githubOwner);

      await this.usersService.create(organization);
    }

    const repository = this.extractRepo(eventData.repository);
    await this.reposService.create(repository);

    const pullRequest = this
      .extractPullRequest(githubPR, creator, repository, organization);

    await this.pullRequestsService.create(pullRequest);

    return;
  }
  async handlePullRequestInitialLabeled(
    eventData: IGithubPullRequestEvent
  ): Promise<void> {
    const {
      githubCreator,
      githubOwner,
      githubPR
    } = this.extractGithubEntities(eventData);
    const pr = this.extractPullRequest(
      githubPR,
      this.extractUser(githubCreator),
      this.extractRepo(eventData.repository),
      this.extractUser(githubOwner)
    );
 
    await this.pullRequestsService.addLabels(pr.prid, eventData.label.name);
  }
  async handlePullRequestLabelAdded(
    eventData: IGithubPullRequestEvent
  ): Promise<void> {
    const {
      githubCreator,
      githubOwner,
      githubPR
    } = this.extractGithubEntities(eventData);
    const pr = this.extractPullRequest(
      githubPR,
      this.extractUser(githubCreator),
      this.extractRepo(eventData.repository),
      this.extractUser(githubOwner)
    );
 
    await this.pullRequestsService.addLabels(pr.prid, eventData.label.name);
  }
  async handlePullRequestLabelRemoved(
    eventData: IGithubPullRequestEvent
  ): Promise<void> {
    const {
      githubCreator,
      githubOwner,
      githubPR
    } = this.extractGithubEntities(eventData);
    const pr = this.extractPullRequest(
      githubPR,
      this.extractUser(githubCreator),
      this.extractRepo(eventData.repository),
      this.extractUser(githubOwner)
    );
 
    await this.pullRequestsService.removeLabels(pr.prid, eventData.label.name);
  }
  async handlePullRequestEdited(
    eventData: IGithubPullRequestEvent
  ): Promise<void> {
    const {
      githubCreator,
      githubOwner,
      githubPR
    } = this.extractGithubEntities(eventData);
    const pr = this.extractPullRequest(
      githubPR,
      this.extractUser(githubCreator),
      this.extractRepo(eventData.repository),
      this.extractUser(githubOwner)
    );
    
    await this.pullRequestsService.editPRData(
      pr.prid,
      { title: pr.title, description: pr.description },
      eventData.changes
    );
  }
  async handlePullRequestAssigneeAdded(
    eventData: IGithubPullRequestEvent
  ): Promise<void> {
    const {
      githubCreator,
      githubOwner,
      githubPR
    } = this.extractGithubEntities(eventData);
    const pr = this.extractPullRequest(
      githubPR,
      this.extractUser(githubCreator),
      this.extractRepo(eventData.repository),
      this.extractUser(githubOwner)
    );

    const githubAssignees = eventData.pull_request.assignees;
    const assignees = githubAssignees
      .map((assignee) => this.extractUser(assignee));

    await this.pullRequestsService.updateAssignees(pr.prid, assignees);
  }
  async handlePullRequestAssigneeRemoved(
    eventData: IGithubPullRequestEvent
  ): Promise<void> {
    const {
      githubCreator,
      githubOwner,
      githubPR
    } = this.extractGithubEntities(eventData);
    const pr = this.extractPullRequest(
      githubPR,
      this.extractUser(githubCreator),
      this.extractRepo(eventData.repository),
      this.extractUser(githubOwner)
    );

    const githubAssignees = eventData.pull_request.assignees;
    const assignees = githubAssignees
      .map((assignee) => this.extractUser(assignee));

    await this.pullRequestsService.updateAssignees(pr.prid, assignees);
  }
  async handlePullRequestReviewRequestAdded(
    eventData: IGithubPullRequestEvent
  ): Promise<void> {
    const {
      githubCreator,
      githubOwner,
      githubPR
    } = this.extractGithubEntities(eventData);
    const pr = this.extractPullRequest(
      githubPR,
      this.extractUser(githubCreator),
      this.extractRepo(eventData.repository),
      this.extractUser(githubOwner)
    );
    const reviewer = this.extractUser(eventData.requested_reviewer);

    await this.pullRequestsService.updateReviewers(pr.prid, reviewer);
  }
  async handlePullRequestReviewRequestRemoved(
    eventData: IGithubPullRequestEvent
  ): Promise<void> {
    const {
      githubCreator,
      githubOwner,
      githubPR
    } = this.extractGithubEntities(eventData);
    const pr = this.extractPullRequest(
      githubPR,
      this.extractUser(githubCreator),
      this.extractRepo(eventData.repository),
      this.extractUser(githubOwner)
    );
    const reviewer = this.extractUser(eventData.requested_reviewer);
    await this.pullRequestsService.updateReviewers(pr.prid, reviewer, true);
  }
  async handlePullRequestReviewCommentAdded(
    eventData: IGithubPullRequestEvent
  ): Promise<void> {
    const {
      githubCreator,
      githubOwner,
      githubPR
    } = this.extractGithubEntities(eventData);
    const pr = this.extractPullRequest(
      githubPR,
      this.extractUser(githubCreator),
      this.extractRepo(eventData.repository),
      this.extractUser(githubOwner)
    );

    const newReviewComment = this.extractReviewComment(eventData.comment);
    await this.pullRequestsService.addReviewComment(pr.prid, newReviewComment);
  }
  async handlePullRequestReviewCommentRemoved(
    eventData: IGithubPullRequestEvent
  ): Promise<void> {
    const {
      githubCreator,
      githubOwner,
      githubPR
    } = this.extractGithubEntities(eventData);
    const pr = this.extractPullRequest(
      githubPR,
      this.extractUser(githubCreator),
      this.extractRepo(eventData.repository),
      this.extractUser(githubOwner)
    );

    const reviewComment = this.extractReviewComment(eventData.comment);
    await this.pullRequestsService
      .removeReviewComment(pr.prid, reviewComment);
  }
  async handlePullRequestReviewCommentEdited(
    eventData: IGithubPullRequestEvent
  ): Promise<void> {
    const {
      githubCreator,
      githubOwner,
      githubPR
    } = this.extractGithubEntities(eventData);
    const pr = this.extractPullRequest(
      githubPR,
      this.extractUser(githubCreator),
      this.extractRepo(eventData.repository),
      this.extractUser(githubOwner)
    );

    const reviewComment = this.extractReviewComment(eventData.comment);
    await this.pullRequestsService
      .editReviewComment(pr.prid, reviewComment);
  }
  async handlePullRequestReviewSubmitted(
    eventData: IGithubPullRequestEvent
  ): Promise<void> {
    const {
      githubCreator,
      githubOwner,
      githubPR
    } = this.extractGithubEntities(eventData);
    const pr = this.extractPullRequest(
      githubPR,
      this.extractUser(githubCreator),
      this.extractRepo(eventData.repository),
      this.extractUser(githubOwner)
    );

    const reviewStatus = this.extractReviewStatus(eventData.review);
    await this.pullRequestsService
      .updateReviewSubmitted(pr.prid, reviewStatus);
  }
  handlePullRequestMerged(
    eventData: IGithubPullRequestEvent
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async handlePullRequestClosed(
    eventData: IGithubPullRequestEvent
  ): Promise<void> {
    const {
      githubCreator,
      githubOwner,
      githubPR
    } = this.extractGithubEntities(eventData);
    const pr = this.extractPullRequest(
      githubPR,
      this.extractUser(githubCreator),
      this.extractRepo(eventData.repository),
      this.extractUser(githubOwner)
    );

   await this.pullRequestsService.updatePRStatus(pr.prid, pr.status);
  }

  private extractGithubEntities(eventData: IGithubPullRequestEvent) {
    return {
      githubPR: eventData.pull_request,
      githubCreator: eventData.pull_request.user,
      githubOwner: eventData.repository.owner
    };
  }

  private extractUser(githubUser: IGithubUser) {
    if (!githubUser) { return; }
    const user = new User({
      username: githubUser.login,
      url: githubUser.html_url,
      avatar: githubUser.avatar_url,
      organization: githubUser.type === 'Organization'
    });

    return user;
  }

  private extractRepo(githubRepo: IGithubRepo) {
    if (!githubRepo) { return; }
    const repo = new Repo({
      fullname: githubRepo.full_name,
      name: githubRepo.name,
      url: githubRepo.html_url,
      organization: githubRepo.owner.type === 'Organization' ?
        githubRepo.owner.login : undefined
    });

    return repo;
  }

  private extractReviewStatus(review: IGithubReview) {
    return {
      id: review.id,
      user: this.extractUser(review.user).username,
      message: review.body || '',
      state: review.state,
      createdOn: review.submitted_at,
      commit: review.commit_id,
      authorAssociation: review.author_association
    };
  }

  private extractPullRequest(
    githubPR: IGithubPullRequest,
    creator: User,
    repository: Repo,
    organization?: User
  ) {
    const pullRequest = new PullRequest({
      prid: `${ repository.fullname }/pull/${ githubPR.number }`,
      title: githubPR.title,
      description: githubPR.body,
      number: githubPR.number,
      creator: creator.username,
      createdOn: new Date(githubPR.created_at),
      url: githubPR.html_url,
      repository: repository.fullname,
      status: this.getPRStatus(githubPR)
    });

    pullRequest.organization = organization && organization.username;

    return pullRequest;
  }

  private extractReviewComment(comment: IGithubReviewComment): IReviewComment {
    return {
      id: comment.id,
      reviewId: comment.pull_request_review_id,
      author: this.extractUser(comment.user).username,
      message: comment.body,
      createdOn: comment.created_at,
      edited: isEqual(comment.created_at, comment.updated_at),
      apiUrl: comment.url,
      file: comment.path,
      commit: comment.commit_id
    };
  }

  private getPRStatus(githubPR: IGithubPullRequest) {
    return githubPR.state === 'open' ?
    PRStatus.OPEN :
    (githubPR.merged ? PRStatus.MERGED : PRStatus.CLOSED);
  }
}
