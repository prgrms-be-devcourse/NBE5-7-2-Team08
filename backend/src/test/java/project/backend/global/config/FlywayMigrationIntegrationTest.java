package project.backend.global.config;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
class FlywayMigrationIntegrationTest {

    @Container
    static MySQLContainer<?> mysql =
        new MySQLContainer<>(DockerImageName.parse("mysql:8.4"))
            .withDatabaseName("devchat")
            .withUsername("test")
            .withPassword("test");

    @Test
    void emptyDatabaseAppliesEveryMigration() {
        Flyway flyway = Flyway.configure()
            .dataSource(mysql.getJdbcUrl(), mysql.getUsername(), mysql.getPassword())
            .locations("classpath:db/migration")
            .load();

        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(5);
    }
}
