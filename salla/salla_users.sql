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
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `username` varchar(255) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `phone` varchar(15) DEFAULT NULL,
  `verification_code` varchar(255) DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT '0',
  `last_code_sent` datetime DEFAULT NULL,
  `reset_code` varchar(6) DEFAULT NULL,
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expiry` bigint DEFAULT NULL,
  `profile_picture` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=97 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (70,'محمد شعبان السيسي','m.sese621@gmail.com','$2b$10$S33kXKEWO7Mggy.ZN9FCe.BkaYYP/Fmk4O18hIGL3R/FQW7DFvxei','2025-04-04 08:44:41','+201121254896','1329',1,'2025-04-27 01:03:59',NULL,NULL,NULL,'profile-70-1746519827609-64854983.png'),(71,'Hema','ebrahimaymenzaki55@gmail.com','$2b$10$BdRlok228CRVVxQJFUPt2OVk2YdQxXG8ccnXZVHe7tTBQYYqn9z4W','2025-04-06 23:49:10','+201271926970','9784',1,'2025-04-07 01:49:10',NULL,NULL,NULL,NULL),(73,'Mohamed Elcici','mohamedshabaanelcici@gmail.com','$2b$10$ud9vXW3ryBR/SJpVPibBNui3wTmKyKmqfIFwGza9B6LHUFENfNb4K','2025-04-13 08:59:36','+201212925469','6218',1,'2025-05-02 00:56:17',NULL,NULL,NULL,'profile-73-1746362326640-414721468.png'),(89,'Mohamed Ahmed','mohamed.ahm4333@gmail.com','$2b$10$6QSFzECugzMEhT2Gmy/a7.7IQdRIIZHKiGlD7FP2Puze3U7Fai35q','2025-04-26 12:45:49','+201005890624','6965',1,'2025-04-26 15:49:19','433661','1ce20626672d0621c5b7098a3866b293c13da6e62ba52dea5baa1094af9a511c',20250426164919,NULL),(93,'Ezzat','wokix86382@astimei.com','$2b$10$Y0wCN02VARPN2dCa3R9bM.AG1C0DnFMRmm.fDnp2RcrLYLcFPmMU6','2025-04-26 21:05:49','+201212925463','2685',0,'2025-04-27 00:05:49',NULL,NULL,NULL,NULL),(95,'test after','rekixel732@ingitel.com','$2b$10$LjFTUpUC8mZFIxa/layFsuCB5MrMipBCprv3DN8p35NBPq9qPjYF6','2025-04-29 15:59:47','+201225455682','2120',1,'2025-04-29 19:00:52',NULL,NULL,NULL,'profile-95-1745944654181-161933056.jpg'),(96,'youseff ezzat','buzzilegame@gmail.com','$2b$10$M7hU4iMaBofoQPKoujDMpeyihe8MKRGKp4VXB6SkPEvPey/pF1.XC','2025-04-30 13:33:27','+201114191941','7903',1,'2025-04-30 16:33:28',NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-05-09 12:35:56
