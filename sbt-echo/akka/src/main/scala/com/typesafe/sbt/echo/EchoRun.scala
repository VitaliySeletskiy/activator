/**
 *  Copyright (C) 2013 Typesafe, Inc <http://typesafe.com>
 */
package com.typesafe.sbt
package echo

import sbt._
import sbt.Keys._
import sbt.Project.Initialize
import java.net.{ URI, URLClassLoader }

object EchoRun {
  import EchoProcess.{ Forked, RunMain }
  import SbtEcho.Echo
  import SbtEcho.EchoKeys._

  val Akka22Version = "2.2.4"
  val Akka23Version = "2.3.9"
  val supportedAkkaVersions = Seq(Akka22Version, Akka23Version)

  val EchoTraceCompile = config("echo-trace-compile").extend(Configurations.RuntimeInternal).hide
  val EchoTraceTest = config("echo-trace-test").extend(EchoTraceCompile, Configurations.TestInternal).hide

  val EchoWeave = config("echo-weave").hide
  val EchoSigar = config("echo-sigar").hide

  case class Sigar(dependency: Option[File], nativeLibraries: Option[File])

  def targetName(config: Configuration) = {
    "echo" + (if (config.name == "runtime") "" else "-" + config.name)
  }

  def traceJavaOptions(aspectjWeaver: Option[File], sigarLibs: Option[File]): Seq[String] = {
    val javaAgent = aspectjWeaver.toSeq map { w => "-javaagent:" + w.getAbsolutePath }
    val aspectjOptions = Seq("-Dorg.aspectj.tracing.factory=default")
    val sigarPath = sigarLibs.toSeq map { s => "-Dorg.hyperic.sigar.path=" + s.getAbsolutePath }
    javaAgent ++ aspectjOptions ++ sigarPath
  }

  def selectAkkaVersion(dependencies: Seq[ModuleID]): Option[String] = {
    findAkkaVersion(dependencies) flatMap supportedAkkaVersion
  }

  def supportedAkkaVersion(akkaVersion: String): Option[String] = {
    if (akkaVersion startsWith "2.2.") Some(Akka22Version)
    else if (akkaVersion startsWith "2.3.") Some(Akka23Version)
    else None
  }

  def akkaVersionReport(akkaVersionOption: Option[String]): String = {
    akkaVersionOption match {
      case Some(akkaVersion) =>
        supportedAkkaVersion(akkaVersion) match {
          case Some(supported) =>
            s"Inspect supports Akka $supported and this project has compatible version $akkaVersion."
          case None =>
            s"This project's Akka version $akkaVersion is not supported; supported versions are ${supportedAkkaVersions.mkString(",")}"
        }
      case None =>
        s"This project does not appear to depend on any known version of Akka. Supported Akka versions are ${supportedAkkaVersions.mkString(",")}."
    }
  }

  def selectTraceDependencies(dependencies: Seq[ModuleID], traceAkkaVersion: Option[String], echoVersion: String, scalaVersion: String): Seq[ModuleID] = {
    if (containsTrace(dependencies)) Seq.empty[ModuleID]
    else traceAkkaVersion match {
      case Some(akkaVersion) => traceAkkaDependencies(akkaVersion, echoVersion, scalaVersion)
      case None => Seq.empty[ModuleID]
    }
  }

  def containsTrace(dependencies: Seq[ModuleID]): Boolean = dependencies exists { module =>
    module.organization == "com.typesafe.trace" && module.name.startsWith("echo-trace-akka")
  }

  def findAkkaVersion(dependencies: Seq[ModuleID]): Option[String] = dependencies find { module =>
    module.organization == "com.typesafe.akka" && module.name.startsWith("akka-")
  } map (_.revision)

  def traceAkkaDependencies(akkaVersion: String, echoVersion: String, scalaVersion: String): Seq[ModuleID] = {
    val crossVersion = akkaCrossVersion(akkaVersion, scalaVersion)
    Seq("com.typesafe.trace" % ("echo-trace-akka-" + akkaVersion) % echoVersion % EchoTraceCompile.name cross crossVersion)
  }

  def akkaCrossVersion(akkaVersion: String, scalaVersion: String): CrossVersion = {
    if (akkaVersion startsWith "2.0.") CrossVersion.Disabled
    else if (akkaVersion startsWith "2.1.") CrossVersion.Disabled
    else if (scalaVersion contains "-") CrossVersion.full
    else CrossVersion.binary
  }

  def weaveDependencies(version: String) = Seq(
    "org.aspectj" % "aspectjweaver" % version % EchoWeave.name)

  def sigarDependencies(version: String) = Seq(
    "com.typesafe.trace" % "echo-sigar-libs" % version % EchoSigar.name)

  def collectTracedClasspath(config: Configuration): Initialize[Task[Classpath]] =
    (classpathTypes, update, streams) map { (types, report, s) =>
      val classpath = Classpaths.managedJars(config, types, report)

      // Print some handy diagnostics about what ended up on the classpath
      def logFor(modulePrefix: String): Unit = {
        val traced = classpath
          .flatMap(_.metadata.get(Keys.moduleID.key).toSeq)
          .filter(_.name.startsWith(s"$modulePrefix-"))
          // drop trace-play-common
          .filterNot(_.name.startsWith(s"$modulePrefix-common"))

        if (traced.isEmpty) {
          // we always trace akka, but only trace play on play projects
          if (modulePrefix == "echo-trace-akka")
            s.log.warn(s"$modulePrefix jars for Inspect have not been added to the classpath.")
        } else if (traced.size > 1) s.log.error(s"Somehow multiple $modulePrefix jars for Inspect are on the classpath: $traced")
        else s.log.info(s"$modulePrefix jar for Inspect is on the echo:run classpath ${traced.head}")
      }

      logFor("echo-trace-akka")
      logFor("echo-trace-play")

      classpath
    }

  def createClasspath(file: File): Classpath = Seq(Attributed.blank(file))

  def findAspectjWeaver: Initialize[Task[Option[File]]] =
    update map { report => report.matching(moduleFilter(organization = "org.aspectj", name = "aspectjweaver")) headOption }

  def findSigar: Initialize[Task[Option[File]]] =
    update map { report => report.matching(moduleFilter(organization = "org.fusesource", name = "sigar")) headOption }

  def seqToConfig(seq: Seq[(String, Any)], indent: Int, quote: Boolean): String = {
    seq map {
      case (k, v) =>
        val indented = " " * indent
        val key = if (quote) "\"%s\"" format k else k
        val value = v
        "%s%s = %s" format (indented, key, value)
    } mkString ("\n")
  }

  def defaultTraceConfig(node: String, traceable: String, sampling: String, tracePort: Int): String = {
    """
      |activator {
      |  trace {
      |    enabled = true
      |    node = "%s"
      |    traceable {
      |%s
      |    }
      |    sampling {
      |%s
      |    }
      |    send {
      |      port = %s
      |      retry = off
      |    }
      |  }
      |}
    """.trim.stripMargin.format(StringUtilities.normalize(node), traceable, sampling, tracePort)
  }

  def includeEchoConfig(configs: Seq[String]): String = {
    val includes = configs map { name =>
      """
        |%s {
        |  include "echo"
        |}
      """.trim.stripMargin.format(name)
    } mkString ("\n")

    """
      |include "echo"
      |%s
    """.trim.stripMargin.format(includes)
  }

  def writeTraceConfig(name: String, configKey: TaskKey[String], includesKey: TaskKey[String]): Initialize[Task[File]] =
    (echoConfigDirectory, configKey, includesKey) map { (confDir, conf, includes) =>
      val configResource = sys.props.getOrElse("config.resource", "application.conf")
      writeConfigFiles(confDir, name, Seq(
        "echo.conf" -> conf,
        configResource -> includes))
    }

  def writeConfigFiles(base: File, name: String, configs: Seq[(String, String)]): File = {
    val dir = base / name
    for ((filename, content) <- configs) {
      if (content.nonEmpty) IO.write(dir / filename, content)
    }
    dir
  }

  def unpackSigar: Initialize[Task[Option[File]]] = (update, echoDirectory) map { (report, dir) =>
    report.matching(moduleFilter(name = "echo-sigar-libs")).headOption map { jar =>
      val unzipped = dir / "sigar"
      IO.unzip(jar, unzipped)
      unzipped
    }
  }

  // Assuming forked execution ONLY
  def echoRunner: Initialize[Task[ScalaRun]] = Def.task {
    if (!(echoTraceSupported in Echo).value) {
      val message = s"Inspect tracing does not work with this project. ${(echoAkkaVersionReport in Echo).value}"
      streams.value.log.error(message)
      sys.error(message)
    } else if (fork.value) {
      val forkConfig = ForkOptions(javaHome.value, outputStrategy.value, Seq.empty, Some(baseDirectory.value), javaOptions.value ++ traceOptions.value, connectInput.value)
      new EchoForkRun(forkConfig)
    } else {
      throw new RuntimeException("Echo only supports operation of forked processes")
    }
  }

  class EchoForkRun(forkConfig: ForkScalaRun) extends ScalaRun {
    def run(mainClass: String, classpath: Seq[File], options: Seq[String], log: Logger): Option[String] = {
      log.info("Running (forked) " + mainClass + " " + options.mkString(" "))
      log.debug("  Classpath:\n\t" + classpath.mkString("\n\t"))
      val forkRun = new Forked(mainClass, forkConfig, temporary = false)
      val exitCode = forkRun.run(mainClass, classpath, options, log).exitValue()
      forkRun.cancelShutdownHook()
      if (exitCode == 0) None
      else Some("Nonzero exit code returned from runner: " + exitCode)
    }
  }

  object SigarClassLoader {
    private var sigarLoader: Option[ClassLoader] = None

    def apply(sigar: Sigar): ClassLoader = synchronized {
      if (sigarLoader.isDefined) {
        sigarLoader.get
      } else if (sigar.dependency.isEmpty || sigar.nativeLibraries.isEmpty) {
        null
      } else {
        sigar.nativeLibraries foreach { s => System.setProperty("org.hyperic.sigar.path", s.getAbsolutePath) }
        val loader = new URLClassLoader(Path.toURLs(sigar.dependency.toSeq), null)
        sigarLoader = Some(loader)
        loader
      }
    }
  }
}
