package project.backend.global.exception.ex;

import project.backend.global.exception.errorcode.ErrorCode;

public class GitHubException extends BaseException {

    public GitHubException(ErrorCode errorCode) {
        super(errorCode);
    }
}
