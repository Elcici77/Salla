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
-- Table structure for table `connected_stores`
--

DROP TABLE IF EXISTS `connected_stores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `connected_stores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `merchant_id` varchar(255) NOT NULL,
  `access_token` text,
  `refresh_token` text,
  `status` varchar(20) DEFAULT 'active',
  `shop_name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `token_expiry` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `merchant_id` (`merchant_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `connected_stores_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=92 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `connected_stores`
--

LOCK TABLES `connected_stores` WRITE;
/*!40000 ALTER TABLE `connected_stores` DISABLE KEYS */;
INSERT INTO `connected_stores` VALUES (81,73,'444452074','ory_at_237UvJaZyJxJY199Amxpoz3XrV3R9X24__y8Z7viFdY.XtBtKj-NKEBJSnh2saGQt5STXHh71G_HrDQWkUMp5SI','ory_rt_4imNqYav9FdCjyewW21QIZ_NzbWFnvahvZBlRPB9P-k.8jA4xPTvqIuLytDTyg6YA4DHI0-o0_ck8Ej2gXHfst8','active','متجر تجريبي','2025-05-05 20:46:58','2025-05-05 20:46:58','2025-05-19 23:46:58'),(91,73,'1150386752','ory_at_fhgmFZ55IOWvQq00tZ_ehaszYlVcimUImARjLcK8zcw.d9vgleWU5BkbenXJpo-5lwdVpCyCL9ES2hAa2q_HRvs','ory_rt_wqlADVSGCsav1HulOAoWk5Mdv-6jUykoz5_v5v47CWw.h7yg6-nIDg5IBzoTfIoKStPLbyj5jSTnkHDX1RpPYsM','active','','2025-05-08 06:18:28','2025-05-08 06:18:28','2025-05-22 09:18:28');
/*!40000 ALTER TABLE `connected_stores` ENABLE KEYS */;
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
