package snap

import xsbti.{AppMain, AppConfiguration}
import java.awt._
import java.awt.event._
import javax.swing._


/** Expose for SBT launcher support. */
class UIMain extends AppMain {

  def run(configuration: AppConfiguration) = {
    // Start the Play app... (TODO - how do we know when we're done?)
    // TODO - Is this hack ok?
    withContextClassloader(play.core.server.NettyServer.main(configuration.arguments))

    // Delay opening the browser a short bit so play can start.
    // TODO - is this worth it?
    Thread sleep 500L

    // openBrowser
    openBrowser()

    // Prevent us from dropping to exit immediately... block on Play running until you see CTRL-C or some such....
    waitForever()
    // TODO - Catch errors and better return value.
    Exit(0)
  }

  def waitForever(): Unit = {
    // TODO - figure out a better way to do this intead of parking a thread.
    this.synchronized(this.wait())
  }

  // TODO - detect port?
  def openBrowser() = {
    val desktop: Option[Desktop] =
      if(Desktop.isDesktopSupported)
        Some(Desktop.getDesktop) filter (_ isSupported Desktop.Action.BROWSE)
      else None

    desktop match {
      case Some(d) => d browse new java.net.URI("http://localhost:9000/")
      case _       => showError("""|Unable to open a web browser!
                                   |Please point your browser at:
                                   | http://localhost:9000/""".stripMargin)
    }
  }

  def withContextClassloader[A](f: => A): A = {
    val current = Thread.currentThread
    val old = current.getContextClassLoader
    current setContextClassLoader getClass.getClassLoader
    try f
    finally current setContextClassLoader old
  }

  // TODO - Is it ok to use swing?  We can detect that actually....
  def showError(errorMsg: String): Unit = {
    // create and configure a text area - fill it with exception text.
                val textArea = new JTextArea
                textArea setFont new Font("Sans-Serif", Font.PLAIN, 16)
                textArea setEditable false
                textArea setText errorMsg
    textArea setLineWrap true

                // stuff it in a scrollpane with a controlled size.
                val scrollPane = new JScrollPane(textArea)
                scrollPane setPreferredSize new Dimension(350, 150)

                // pass the scrollpane to the joptionpane.
                JOptionPane.showMessageDialog(null, scrollPane, "O SNAP!", JOptionPane.ERROR_MESSAGE)
  }
  // Wrapper to return exit codes.
  case class Exit(val code: Int) extends xsbti.Exit
}