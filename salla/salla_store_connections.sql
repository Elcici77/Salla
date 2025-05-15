-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: localhost    Database: salla
-- ------------------------------------------------------
-- Server version	9.2.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `store_connections`
--

DROP TABLE IF EXISTS `store_connections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `store_connections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `state` varchar(64) NOT NULL,
  `merchant_id` varchar(255) DEFAULT NULL,
  `access_token` text,
  `refresh_token` text,
  `status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
  `error_message` text,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL DEFAULT ((now() + interval 10 minute)),
  PRIMARY KEY (`id`),
  UNIQUE KEY `state_unique` (`state`),
  KEY `user_id` (`user_id`),
  KEY `idx_expires` (`expires_at`),
  KEY `idx_status` (`status`),
  CONSTRAINT `store_connections_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=157 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `store_connections`
--

LOCK TABLES `store_connections` WRITE;
/*!40000 ALTER TABLE `store_connections` DISABLE KEYS */;
INSERT INTO `store_connections` VALUES (41,96,'eb81e6211b18a5094094c3e207e75de31fc98e4be9bf920da5ae5edbe01afc2d','444452074','ory_at_-n2RG-oTa04vKXX2bT53R6dzKFbhBu3Hw4XT6l_v1b4.crSXuArVJmNdLzrZ2k7HCwJ_4xay7bn8GSefsRqJers','ory_rt_G3znW8dJTdKDmilvlfHilvfg1t7B8yCSSXWjDZbG1qA.RfK9bxSrf9WUfUbRiOkovUKJo40Czmbej4zNLt-oPJ8','completed',NULL,NULL,'2025-04-30 13:35:07','2025-04-30 13:36:23','2025-05-14 16:36:22'),(129,73,'ade7bac7b103afd79f8b38afc18760ed90a59734888ac3d25223b7c419b67c6c','444452074',NULL,NULL,'completed',NULL,NULL,'2025-05-05 17:42:36','2025-05-05 17:42:46','2025-05-05 20:52:36'),(134,73,'2bbb472f92091619ebebbc6b5f3a848c30b3ae97e348714c77842ca49647e633','444452074',NULL,NULL,'completed',NULL,NULL,'2025-05-05 20:46:37','2025-05-05 20:46:58','2025-05-05 23:56:37'),(156,73,'052120ad1cb70f61eb43af8cfd5dbdf294694526c03174d2044a404e0cc61047','1150386752',NULL,NULL,'completed',NULL,NULL,'2025-05-08 06:18:21','2025-05-08 06:18:28','2025-05-08 09:28:21');
/*!40000 ALTER TABLE `store_connections` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-05-09 12:35:55
