package project.backend.domain.chat.github;

import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import project.backend.global.exception.errorcode.GitHubErrorCode;
import project.backend.global.exception.ex.GitHubException;
import reactor.core.publisher.Mono;

@Component
@RequiredArgsConstructor
@Slf4j
public class GitHubClient {

	private final WebClient.Builder webClientBuilder;

	public boolean validateAdminPermission(String accessToken, String owner, String repo) {
		String url = "https://api.github.com/repos/" + owner + "/" + repo; //요청할 api

		Map<String, Object> response = webClientBuilder.build()
			.get()
			.uri(url)
			.header("Authorization", "Bearer " + accessToken)
			.retrieve()
			.onStatus(HttpStatusCode::is4xxClientError, error ->
				error.bodyToMono(String.class)
					.flatMap(errorBody -> {
						if (error.statusCode() == HttpStatus.UNAUTHORIZED) {
							log.error(errorBody);
							return Mono.error(new GitHubException(GitHubErrorCode.INVALID_TOKEN));
						} else if (error.statusCode() == HttpStatus.NOT_FOUND) {
							log.error(errorBody);
							return Mono.error(new GitHubException(GitHubErrorCode.REPO_NOT_FOUND));
						} else {
							log.error("GitHubErrorCode.CLIENT_ERROR: {}", errorBody);
							return Mono.error(new GitHubException(GitHubErrorCode.CLIENT_ERROR));
						}
					})
			)
			.onStatus(HttpStatusCode::is5xxServerError, error ->
				error.bodyToMono(String.class)
					.flatMap(errorBody -> {
						log.error("GitHubErrorCode.CLIENT_ERROR: {}", errorBody);
						return Mono.error(new GitHubException(GitHubErrorCode.SERVER_ERROR));
					})
			)
			.bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {
			})
			.block();

		// jon 응답 구조에서 "permissions": {"admin": true} 이면 레포 접근 권한 있는거임
		if (response == null || !response.containsKey("permissions")) {
			throw new GitHubException(GitHubErrorCode.UNEXPECTED_RESPONSE);
		}

		Map<String, Boolean> permissions = (Map<String, Boolean>) response.get("permissions");
		boolean isAdmin = permissions.getOrDefault("admin", false);

		if (!isAdmin) {
			throw new GitHubException(GitHubErrorCode.UNAUTHORIZED_REPO);
		}

		return true;
	}

	public void registerWebhook(String accessToken, String owner, String repo, String webhookUrl) {
		String apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/hooks";

		Map<String, Object> requestBody = Map.of(
			"name", "web",
			"active", true,
			"events", List.of("issues", "pull_request", "pull_request_review"),
			"config", Map.of(
				"url", webhookUrl,
				"content_type", "json",
				"insecure_ssl", "0"
			)
		);

		try {
			webClientBuilder.build()
				.post()
				.uri(apiUrl)
				.header("Authorization", "Bearer " + accessToken)
				.header("Accept", "application/vnd.github.v3+json")
				.bodyValue(requestBody)
				.retrieve()
				.toBodilessEntity()
				.block();
		} catch (Exception e) {
			log.error("웹훅 등록 중 예외 예상치 못한 발생", e);
			throw new GitHubException(GitHubErrorCode.WEBHOOK_REGISTER_FAILED);
		}
	}

	private WebClient getWebClient(String gitHubAccessToken) {
		return WebClient.builder()
			.baseUrl("https://api.github.com")
			.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + gitHubAccessToken)
			.defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json")
			.build();
	}

	public String getPrivateEmail(String gitHubAccessToken) {

		WebClient webClient = getWebClient(gitHubAccessToken);

		List<Map<String, Object>> emailList = webClient.get()
			.uri("/user/emails")
			.retrieve()
			.bodyToMono(new ParameterizedTypeReference<List<Map<String, Object>>>() {
			})
			.block();

		if (emailList == null || emailList.isEmpty()) {
			throw new IllegalStateException("GitHub 이메일 정보를 불러올 수 없습니다.");
		}

		String privateEmail = null;

		for (Map<String, Object> email : emailList) {
			System.out.println(email.get("email"));
			System.out.println("primary = " + email.get("primary"));

			if (Boolean.TRUE.equals(email.get("primary"))) {
				privateEmail = (String) email.get("email");
				break;
			}
		}

		if (privateEmail == null) {
			privateEmail = emailList.getFirst().get("email").toString();
		}

		return privateEmail;

	}
}
