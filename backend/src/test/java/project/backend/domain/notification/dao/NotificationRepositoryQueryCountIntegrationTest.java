package project.backend.domain.notification.dao;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import project.backend.domain.notification.dto.NotificationDto;
import project.backend.global.config.TestRedisConfig;

@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
@Import(TestRedisConfig.class)
class NotificationRepositoryQueryCountIntegrationTest {

    @Container
    static MySQLContainer<?> mysql = new MySQLContainer<>(DockerImageName.parse("mysql:8.4"))
        .withDatabaseName("testdb").withUsername("test").withPassword("test");

    @Container
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
        .withExposedPorts(6379);

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", mysql::getJdbcUrl);
        registry.add("spring.datasource.username", mysql::getUsername);
        registry.add("spring.datasource.password", mysql::getPassword);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
        registry.add("spring.jpa.properties.hibernate.generate_statistics", () -> true);
    }

    @Autowired NotificationRepository notificationRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired EntityManagerFactory entityManagerFactory;
    @Autowired EntityManager entityManager;

    @Test
    @Transactional
    @DisplayName("알림 페이지 DTO 변환은 목록과 count 두 쿼리만 실행한다")
    void notificationPageDtoConversion_usesTwoStatementsForContentAndCount() {
        jdbcTemplate.update("INSERT INTO member (member_id, nickname, profile_image, username) VALUES (1001, 'receiver', 'image', 'receiver-query-count')");
        for (long id = 1; id <= 20; id++) {
            jdbcTemplate.update("INSERT INTO member (member_id, nickname, profile_image, username) VALUES (?, ?, 'image', ?)", 1001 + id, "sender-" + id, "sender-query-count-" + id);
            jdbcTemplate.update("INSERT INTO notification (id, is_read, receiver_member_id, sender_member_id, type) VALUES (?, false, 1001, ?, 'NEW_DM')", id + 1000, 1001 + id);
        }

        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        notificationRepository.getNotifications(1001L, org.springframework.data.domain.PageRequest.of(0, 20))
            .map(NotificationDto::ofNotification);

        assertThat(statistics.getPrepareStatementCount()).isEqualTo(2);
    }

    @Test
    @Transactional
    @DisplayName("fetch 없는 알림 Page DTO 변환은 count와 sender 추가 SQL을 실행한다")
    void notificationPageDtoConversion_withoutFetchGraphExecutesAdditionalSenderQueries() {
        jdbcTemplate.update("INSERT INTO member (member_id, nickname, profile_image, username) VALUES (2001, 'receiver', 'image', 'receiver-baseline')");
        for (long id = 1; id <= 20; id++) {
            jdbcTemplate.update("INSERT INTO member (member_id, nickname, profile_image, username) VALUES (?, ?, 'image', ?)", 2001 + id, "sender-" + id, "sender-baseline-" + id);
            jdbcTemplate.update("INSERT INTO notification (id, is_read, receiver_member_id, sender_member_id, type) VALUES (?, false, 2001, ?, 'NEW_DM')", id + 2000, 2001 + id);
        }

        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        entityManager.clear();
        statistics.clear();

        entityManager.createQuery("SELECT n FROM Notification n WHERE n.receiver.id = 2001", project.backend.domain.notification.entity.Notification.class)
            .setMaxResults(20).getResultList().stream().map(NotificationDto::ofNotification).toList();
        entityManager.createQuery(
                "SELECT COUNT(n) FROM Notification n WHERE n.receiver.id = 2001", Long.class)
            .getSingleResult();

        assertThat(statistics.getPrepareStatementCount()).isEqualTo(23);
    }

}
