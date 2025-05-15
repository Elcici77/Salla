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
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `merchant_id` varchar(255) NOT NULL,
  `customer_id` varchar(255) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `total_orders` int DEFAULT '0',
  `total_spent` decimal(10,2) DEFAULT '0.00',
  `last_order_date` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `merchant_customer` (`merchant_id`,`customer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=791 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,'602421879','test123','عميل تجريبي','0512345678','test@example.com',3,500.00,'2025-05-03 15:51:33','2025-05-03 12:51:33','2025-05-03 12:51:33'),(2,'444452074','1109900279','فاطمة الشامسي','555555555',NULL,12,0.00,'2025-05-04 15:55:16','2025-05-04 11:30:03','2025-05-09 08:24:51'),(3,'444452074','2089584537','محمد احمد هانى','547020862','aljahmi2013@gmail.com',12,0.00,'2025-05-04 15:55:16','2025-05-04 11:30:03','2025-05-09 08:24:51'),(54,'1150386752','1898749887','for testing','572103229',NULL,0,0.00,NULL,'2025-05-05 12:45:49','2025-05-08 06:17:34'),(55,'1150386752','1109900279','فاطمة الشامسي','555555555',NULL,0,0.00,NULL,'2025-05-05 12:45:49','2025-05-08 06:17:34'),(142,'444452074','668628359','محمد شعبان محمد','500112982','hematest@gmail.com',0,0.00,NULL,'2025-05-05 20:46:59','2025-05-09 08:24:51'),(305,'1150386752','668628359','متجر تفعيل الان','500112982','tafiel@gmail.com',0,0.00,NULL,'2025-05-06 08:34:03','2025-05-08 06:17:34');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
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
